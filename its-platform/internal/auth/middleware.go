package auth

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

const (
	claimsKey     = "auth_claims"
	operatorIDKey = "operator_id"
)

// RequireAuth validates the Bearer JWT from the Authorization header.
// On success it injects the *Claims into the Gin context.
func RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" || !strings.HasPrefix(header, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing or invalid authorization header"})
			return
		}

		tokenStr := strings.TrimPrefix(header, "Bearer ")
		claims, err := ValidateToken(tokenStr)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}

		c.Set(claimsKey, claims)
		c.Next()
	}
}

// RequireRole aborts with 403 if the authenticated user's role is not in the allowed list.
func RequireRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims := GetClaims(c)
		if claims == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
			return
		}

		for _, r := range roles {
			if claims.Role == r {
				c.Next()
				return
			}
		}

		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
	}
}

// TenantFilter injects the operator_id from the JWT claims into the Gin context.
// For fiscalizador and superadmin roles, operator_id is set to "" (no tenant restriction).
func TenantFilter() gin.HandlerFunc {
	return func(c *gin.Context) {
		claims := GetClaims(c)
		if claims == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
			return
		}

		opID := claims.OperatorID
		// fiscalizador and superadmin see all operators
		if claims.Role == "fiscalizador" || claims.Role == "superadmin" {
			opID = ""
		}

		c.Set(operatorIDKey, opID)
		c.Next()
	}
}

// GetClaims retrieves the JWT claims stored in the Gin context.
// Returns nil if RequireAuth middleware has not run or failed.
func GetClaims(c *gin.Context) *Claims {
	val, exists := c.Get(claimsKey)
	if !exists {
		return nil
	}
	claims, _ := val.(*Claims)
	return claims
}

// GetOperatorID retrieves the operator_id injected by TenantFilter.
// Returns an empty string if the user is a fiscalizador or superadmin (cross-tenant access).
func GetOperatorID(c *gin.Context) string {
	val, exists := c.Get(operatorIDKey)
	if !exists {
		return ""
	}
	id, _ := val.(string)
	return id
}
