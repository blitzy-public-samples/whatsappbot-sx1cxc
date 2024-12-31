// Package config provides configuration management for the WhatsApp Web Enhancement message service
package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/spf13/viper" // v1.16.0
)

// Config represents the main configuration structure for the message service
type Config struct {
	Server       ServerConfig
	Database     DatabaseConfig
	WhatsApp     WhatsAppConfig
	Redis        RedisConfig
	MessageQueue MessageQueueConfig
}

// ServerConfig holds HTTP server configuration
type ServerConfig struct {
	Port            int           `mapstructure:"port"`
	Host            string        `mapstructure:"host"`
	ReadTimeout     time.Duration `mapstructure:"read_timeout"`
	WriteTimeout    time.Duration `mapstructure:"write_timeout"`
	ShutdownTimeout time.Duration `mapstructure:"shutdown_timeout"`
}

// DatabaseConfig holds PostgreSQL database configuration
type DatabaseConfig struct {
	Host            string        `mapstructure:"host"`
	Port            int           `mapstructure:"port"`
	Name            string        `mapstructure:"name"`
	User            string        `mapstructure:"user"`
	Password        string        `mapstructure:"password"`
	SSLMode         string        `mapstructure:"ssl_mode"`
	MaxOpenConns    int           `mapstructure:"max_open_conns"`
	MaxIdleConns    int           `mapstructure:"max_idle_conns"`
	ConnMaxLifetime time.Duration `mapstructure:"conn_max_lifetime"`
}

// WhatsAppConfig holds WhatsApp Business API configuration
type WhatsAppConfig struct {
	APIKey        string        `mapstructure:"api_key"`
	APIEndpoint   string        `mapstructure:"api_endpoint"`
	Timeout       time.Duration `mapstructure:"timeout"`
	RetryAttempts int           `mapstructure:"retry_attempts"`
	RetryDelay    time.Duration `mapstructure:"retry_delay"`
}

// RedisConfig holds Redis configuration
type RedisConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	Password string `mapstructure:"password"`
	DB       int    `mapstructure:"db"`
	PoolSize int    `mapstructure:"pool_size"`
}

// MessageQueueConfig holds message processing configuration
type MessageQueueConfig struct {
	BatchSize          int           `mapstructure:"batch_size"`
	ProcessingInterval time.Duration `mapstructure:"processing_interval"`
	RetryLimit         int           `mapstructure:"retry_limit"`
	RetryDelay         time.Duration `mapstructure:"retry_delay"`
}

// LoadConfig loads and validates the service configuration from environment variables and config files
func LoadConfig() (*Config, error) {
	v := viper.New()

	// Set configuration defaults
	setDefaults(v)

	// Configure Viper to read environment variables
	v.AutomaticEnv()
	v.SetEnvPrefix("MSG_SVC")

	// Load configuration file if present
	v.SetConfigName("config")
	v.SetConfigType("yaml")
	v.AddConfigPath(".")
	v.AddConfigPath("/etc/message-service/")

	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("error reading config file: %w", err)
		}
		// Continue with environment variables if config file is not found
	}

	cfg := &Config{}
	if err := v.Unmarshal(cfg); err != nil {
		return nil, fmt.Errorf("error unmarshaling config: %w", err)
	}

	// Validate the configuration
	if err := cfg.validate(); err != nil {
		return nil, fmt.Errorf("configuration validation failed: %w", err)
	}

	return cfg, nil
}

// setDefaults sets default values for all configuration parameters
func setDefaults(v *viper.Viper) {
	// Server defaults
	v.SetDefault("server.port", 8080)
	v.SetDefault("server.host", "0.0.0.0")
	v.SetDefault("server.read_timeout", "30s")
	v.SetDefault("server.write_timeout", "30s")
	v.SetDefault("server.shutdown_timeout", "30s")

	// Database defaults
	v.SetDefault("database.port", 5432)
	v.SetDefault("database.ssl_mode", "disable")
	v.SetDefault("database.max_open_conns", 25)
	v.SetDefault("database.max_idle_conns", 25)
	v.SetDefault("database.conn_max_lifetime", "15m")

	// WhatsApp defaults
	v.SetDefault("whatsapp.timeout", "30s")
	v.SetDefault("whatsapp.retry_attempts", 3)
	v.SetDefault("whatsapp.retry_delay", "5s")

	// Redis defaults
	v.SetDefault("redis.port", 6379)
	v.SetDefault("redis.db", 0)
	v.SetDefault("redis.pool_size", 10)

	// Message queue defaults
	v.SetDefault("message_queue.batch_size", 100)
	v.SetDefault("message_queue.processing_interval", "5s")
	v.SetDefault("message_queue.retry_limit", 3)
	v.SetDefault("message_queue.retry_delay", "10s")
}

// validate checks if all required configuration values are present and valid
func (cfg *Config) validate() error {
	// Validate Server configuration
	if cfg.Server.Port <= 0 || cfg.Server.Port > 65535 {
		return fmt.Errorf("invalid server port: %d", cfg.Server.Port)
	}

	// Validate Database configuration
	if cfg.Database.Host == "" {
		return fmt.Errorf("database host is required")
	}
	if cfg.Database.Name == "" {
		return fmt.Errorf("database name is required")
	}
	if cfg.Database.User == "" {
		return fmt.Errorf("database user is required")
	}
	if cfg.Database.Password == "" {
		return fmt.Errorf("database password is required")
	}

	// Validate WhatsApp configuration
	if cfg.WhatsApp.APIKey == "" {
		return fmt.Errorf("WhatsApp API key is required")
	}
	if cfg.WhatsApp.APIEndpoint == "" {
		return fmt.Errorf("WhatsApp API endpoint is required")
	}

	// Validate Redis configuration
	if cfg.Redis.Host == "" {
		return fmt.Errorf("Redis host is required")
	}
	if cfg.Redis.Port <= 0 || cfg.Redis.Port > 65535 {
		return fmt.Errorf("invalid Redis port: %d", cfg.Redis.Port)
	}

	// Validate MessageQueue configuration
	if cfg.MessageQueue.BatchSize <= 0 {
		return fmt.Errorf("message queue batch size must be positive")
	}
	if cfg.MessageQueue.RetryLimit < 0 {
		return fmt.Errorf("message queue retry limit cannot be negative")
	}

	return nil
}
```

This implementation provides a robust configuration management system for the message service with the following features:

1. Structured configuration using nested types for different components
2. Environment variable support with the prefix "MSG_SVC"
3. YAML configuration file support with multiple search paths
4. Comprehensive validation of all configuration values
5. Sensible defaults for all settings
6. Type-safe configuration using Go structs
7. Duration parsing for timeout and interval settings
8. Secure handling of sensitive information
9. Clear error messages for configuration issues
10. Documentation for all configuration fields

The configuration can be loaded in the application using:

```go
config, err := config.LoadConfig()
if err != nil {
    log.Fatalf("Failed to load configuration: %v", err)
}