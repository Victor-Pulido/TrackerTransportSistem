package handler

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/its-demo/platform/internal/auth"
	"github.com/its-demo/platform/internal/repository"
	"golang.org/x/crypto/bcrypt"
)

// AuthHandler handles authentication endpoints.
type AuthHandler struct {
	DB *sql.DB
}

// NewAuthHandler creates a new AuthHandler.
func NewAuthHandler(db *sql.DB) *AuthHandler {
	return &AuthHandler{DB: db}
}

// loginRequest is the expected JSON body for POST /auth/login.
type loginRequest struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// Login authenticates a user with email/password and returns a JWT.
// POST /auth/login
func (h *AuthHandler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email and password are required"})
		return
	}

	user, err := repository.GetUserByEmail(h.DB, req.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	token, err := auth.GenerateToken(*user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token generation failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": gin.H{
			"id":          user.ID,
			"email":       user.Email,
			"full_name":   user.FullName,
			"role":        user.Role,
			"operator_id": user.OperatorID,
		},
	})
}
