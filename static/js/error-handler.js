// Global Error Handler for Ignasia Website
(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        enableLogging: true,
        enableUserNotifications: true,
        retryAttempts: 3,
        retryDelay: 1000,
        offlineCheckInterval: 5000
    };

    // Error types
    const ERROR_TYPES = {
        NETWORK: 'network',
        VALIDATION: 'validation',
        API: 'api',
        JAVASCRIPT: 'javascript',
        OFFLINE: 'offline'
    };

    // Initialize error handling system
    function initErrorHandling() {
        setupGlobalErrorHandlers();
        setupOfflineDetection();
        setupFormValidation();
        initializeUI();
    }

    // Global error handlers
    function setupGlobalErrorHandlers() {
        // Catch unhandled JavaScript errors
        window.addEventListener('error', function(event) {
            handleError({
                type: ERROR_TYPES.JAVASCRIPT,
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error
            });
        });

        // Catch unhandled promise rejections
        window.addEventListener('unhandledrejection', function(event) {
            handleError({
                type: ERROR_TYPES.JAVASCRIPT,
                message: 'Unhandled Promise Rejection',
                error: event.reason
            });
        });
    }

    // Offline detection and handling
    function setupOfflineDetection() {
        let offlineIndicator = null;

        function createOfflineIndicator() {
            if (!offlineIndicator) {
                offlineIndicator = document.createElement('div');
                offlineIndicator.className = 'offline-indicator';
                offlineIndicator.innerHTML = '⚠️ You are offline. Some features may not work.';
                document.body.appendChild(offlineIndicator);
            }
            return offlineIndicator;
        }

        function showOfflineIndicator() {
            const indicator = createOfflineIndicator();
            indicator.classList.add('show');
        }

        function hideOfflineIndicator() {
            if (offlineIndicator) {
                offlineIndicator.classList.remove('show');
            }
        }

        // Online/offline event listeners
        window.addEventListener('online', function() {
            hideOfflineIndicator();
            logError('Connection restored', ERROR_TYPES.OFFLINE);
        });

        window.addEventListener('offline', function() {
            showOfflineIndicator();
            handleError({
                type: ERROR_TYPES.OFFLINE,
                message: 'Connection lost',
                userMessage: 'You are currently offline. Some features may not work properly.'
            });
        });

        // Periodic connectivity check
        setInterval(function() {
            if (!navigator.onLine) {
                showOfflineIndicator();
            }
        }, CONFIG.offlineCheckInterval);
    }

    // Form validation and error handling
    function setupFormValidation() {
        document.addEventListener('DOMContentLoaded', function() {
            const forms = document.querySelectorAll('form');
            forms.forEach(function(form) {
                setupFormErrorHandling(form);
            });
        });
    }

    function setupFormErrorHandling(form) {
        const inputs = form.querySelectorAll('input, textarea, select');
        
        // Real-time validation
        inputs.forEach(function(input) {
            input.addEventListener('blur', function() {
                validateField(input);
            });

            input.addEventListener('input', function() {
                clearFieldError(input);
            });
        });

        // Form submission handling
        form.addEventListener('submit', function(event) {
            event.preventDefault();
            handleFormSubmission(form);
        });
    }

    function validateField(field) {
        const errors = [];
        const value = field.value.trim();
        const fieldName = field.name || field.id;

        // Required field validation
        if (field.hasAttribute('required') && !value) {
            errors.push(`${getFieldLabel(field)} is required`);
        }

        // Email validation
        if (field.type === 'email' && value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                errors.push('Please enter a valid email address');
            }
        }

        // Display errors
        if (errors.length > 0) {
            showFieldError(field, errors[0]);
            return false;
        } else {
            clearFieldError(field);
            return true;
        }
    }

    function showFieldError(field, message) {
        const errorElement = document.getElementById(field.name + '-error') || 
                           document.getElementById(field.id + '-error');
        
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }

        field.classList.add('error');
        field.setAttribute('aria-invalid', 'true');
    }

    function clearFieldError(field) {
        const errorElement = document.getElementById(field.name + '-error') || 
                           document.getElementById(field.id + '-error');
        
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.style.display = 'none';
        }

        field.classList.remove('error');
        field.removeAttribute('aria-invalid');
    }

    function getFieldLabel(field) {
        const label = document.querySelector(`label[for="${field.id}"]`);
        return label ? label.textContent.replace('*', '').trim() : field.name || 'Field';
    }

    // Form submission with error handling
    function handleFormSubmission(form) {
        const formData = new FormData(form);
        const statusElement = document.getElementById('form-status');
        
        // Validate all fields
        const inputs = form.querySelectorAll('input[required], textarea[required], select[required]');
        let isValid = true;

        inputs.forEach(function(input) {
            if (!validateField(input)) {
                isValid = false;
            }
        });

        if (!isValid) {
            handleError({
                type: ERROR_TYPES.VALIDATION,
                message: 'Form validation failed',
                userMessage: 'Please correct the errors above and try again.'
            });
            return;
        }

        // Show loading state
        const submitButton = form.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;
        submitButton.innerHTML = '<span class="spinner"></span>Sending...';
        submitButton.disabled = true;

        // Simulate form submission (replace with actual endpoint)
        submitFormWithRetry(formData)
            .then(function(response) {
                showFormStatus(statusElement, 'Thank you! Your message has been sent successfully.', 'success');
                form.reset();
            })
            .catch(function(error) {
                handleError({
                    type: ERROR_TYPES.API,
                    message: 'Form submission failed',
                    error: error,
                    userMessage: 'Failed to send message. Please try again or contact us directly.'
                });
                showFormStatus(statusElement, 'Failed to send message. Please try again.', 'error');
            })
            .finally(function() {
                submitButton.textContent = originalText;
                submitButton.disabled = false;
            });
    }

    function submitFormWithRetry(formData, attempt = 1) {
        return new Promise(function(resolve, reject) {
            // Simulate API call (replace with actual form submission logic)
            setTimeout(function() {
                if (Math.random() > 0.7) { // Simulate 30% failure rate for demo
                    resolve({ success: true });
                } else {
                    if (attempt < CONFIG.retryAttempts) {
                        setTimeout(function() {
                            submitFormWithRetry(formData, attempt + 1)
                                .then(resolve)
                                .catch(reject);
                        }, CONFIG.retryDelay * attempt);
                    } else {
                        reject(new Error('Network request failed after ' + CONFIG.retryAttempts + ' attempts'));
                    }
                }
            }, 1000);
        });
    }

    function showFormStatus(statusElement, message, type) {
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = 'form-status ' + type;
            statusElement.style.display = 'block';

            // Auto-hide success messages
            if (type === 'success') {
                setTimeout(function() {
                    statusElement.style.display = 'none';
                }, 5000);
            }
        }
    }

    // Network request wrapper with error handling
    function makeRequest(url, options = {}) {
        return new Promise(function(resolve, reject) {
            // Check if offline
            if (!navigator.onLine) {
                reject(new Error('No internet connection'));
                return;
            }

            const defaultOptions = {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            const requestOptions = Object.assign({}, defaultOptions, options);

            fetch(url, requestOptions)
                .then(function(response) {
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    return response.json();
                })
                .then(resolve)
                .catch(function(error) {
                    handleError({
                        type: ERROR_TYPES.NETWORK,
                        message: 'Network request failed',
                        error: error,
                        url: url
                    });
                    reject(error);
                });
        });
    }

    // Central error handling function
    function handleError(errorInfo) {
        logError(errorInfo);

        if (CONFIG.enableUserNotifications && errorInfo.userMessage) {
            showUserNotification(errorInfo.userMessage, 'error');
        }

        // Handle specific error types
        switch (errorInfo.type) {
            case ERROR_TYPES.NETWORK:
                handleNetworkError(errorInfo);
                break;
            case ERROR_TYPES.VALIDATION:
                handleValidationError(errorInfo);
                break;
            case ERROR_TYPES.API:
                handleApiError(errorInfo);
                break;
            case ERROR_TYPES.JAVASCRIPT:
                handleJavaScriptError(errorInfo);
                break;
            case ERROR_TYPES.OFFLINE:
                handleOfflineError(errorInfo);
                break;
        }
    }

    function handleNetworkError(errorInfo) {
        // Implement network-specific error handling
        if (errorInfo.error && errorInfo.error.message.includes('Failed to fetch')) {
            showUserNotification('Network connection problem. Please check your internet connection.', 'error');
        }
    }

    function handleValidationError(errorInfo) {
        // Validation errors are typically handled at the field level
        // This is for any additional validation error handling
    }

    function handleApiError(errorInfo) {
        // Handle API-specific errors
        if (errorInfo.error && errorInfo.error.message.includes('500')) {
            showUserNotification('Server error. Please try again later.', 'error');
        }
    }

    function handleJavaScriptError(errorInfo) {
        // Handle JavaScript runtime errors
        // In production, you might want to send these to an error tracking service
    }

    function handleOfflineError(errorInfo) {
        // Offline errors are handled by the offline detection system
    }

    // User notification system
    function showUserNotification(message, type = 'info') {
        let notification = document.getElementById('error-notification');
        
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'error-notification';
            notification.className = 'error-banner';
            document.body.insertBefore(notification, document.body.firstChild);
        }

        notification.textContent = message;
        notification.className = `error-banner ${type}`;
        notification.style.display = 'block';

        // Auto-hide after 5 seconds
        setTimeout(function() {
            notification.style.display = 'none';
        }, 5000);
    }

    // Logging function
    function logError(errorInfo, type = null) {
        if (!CONFIG.enableLogging) return;

        const logData = {
            timestamp: new Date().toISOString(),
            type: type || errorInfo.type || 'unknown',
            message: errorInfo.message || errorInfo,
            url: window.location.href,
            userAgent: navigator.userAgent
        };

        if (errorInfo.error) {
            logData.stack = errorInfo.error.stack;
            logData.errorMessage = errorInfo.error.message;
        }

        if (errorInfo.filename) {
            logData.filename = errorInfo.filename;
            logData.lineno = errorInfo.lineno;
            logData.colno = errorInfo.colno;
        }

        console.error('Error logged:', logData);

        // In production, send to error tracking service
        // sendToErrorTrackingService(logData);
    }

    // Initialize UI components
    function initializeUI() {
        document.addEventListener('DOMContentLoaded', function() {
            // Add any UI initialization code here
            addGracefulDegradation();
        });
    }

    // Graceful degradation for JavaScript-dependent features
    function addGracefulDegradation() {
        // Add 'js-enabled' class to body for CSS targeting
        document.body.classList.add('js-enabled');

        // Handle cases where JavaScript features fail
        const interactiveElements = document.querySelectorAll('[data-requires-js]');
        interactiveElements.forEach(function(element) {
            element.addEventListener('error', function() {
                // Provide fallback functionality
                const fallback = element.getAttribute('data-fallback');
                if (fallback) {
                    element.innerHTML = fallback;
                }
            });
        });
    }

    // Public API
    window.IgnasiaErrorHandler = {
        handleError: handleError,
        makeRequest: makeRequest,
        showNotification: showUserNotification,
        validateField: validateField,
        logError: logError
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initErrorHandling);
    } else {
        initErrorHandling();
    }

})();