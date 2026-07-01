package auth

import (
	"errors"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/its-demo/platform/internal/domain"
)

// Claims holds the JWT payload for authenticated users.
type Claims struct {
	UserID     string `json:"user_id"`
	OperatorID string `json:"operator_id"`
	Role       string `json:"role"`
	FullName   string `json:"full_name"`
	jwt.RegisteredClaims
}

func jwtSecret() []byte {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "its-demo-secret-2026"
	}
	return []byte(secret)
}

// GenerateToken creates a signed JWT for the given user, valid for 24 hours.
func GenerateToken(user domain.User) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID:     user.ID,
		OperatorID: user.OperatorID,
		Role:       user.Role,
		FullName:   user.FullName,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.ID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(24 * time.Hour)),
			Issuer:    "its-platform",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret())
}

// ValidateToken parses and validates a JWT string, returning the claims on success.
func ValidateToken(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return jwtSecret(), nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}
