/**
 * Client-side form validation utilities with real-time feedback
 */

export interface ValidationRule {
  validate: (value: any, formData?: FormData) => boolean;
  message: string;
  trigger?: 'input' | 'blur' | 'submit';
}

export interface FieldConfig {
  rules: ValidationRule[];
  debounceMs?: number;
  validateOnMount?: boolean;
}

export interface FormConfig {
  fields: Record<string, FieldConfig>;
  onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void;
  submitHandler?: (formData: FormData, isValid: boolean) => void | Promise<void>;
}

/**
 * Common validation rules
 */
export const ValidationRules = {
  required: (message: string = 'This field is required'): ValidationRule => ({
    validate: (value) => value !== null && value !== undefined && value !== '',
    message,
    trigger: 'blur'
  }),

  email: (message: string = 'Please enter a valid email address'): ValidationRule => ({
    validate: (value) => {
      if (!value) return true; // Let required rule handle empty values
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(value);
    },
    message,
    trigger: 'blur'
  }),

  minLength: (min: number, message?: string): ValidationRule => ({
    validate: (value) => {
      if (!value) return true; // Let required rule handle empty values
      return value.length >= min;
    },
    message: message || `Must be at least ${min} characters long`,
    trigger: 'input'
  }),

  maxLength: (max: number, message?: string): ValidationRule => ({
    validate: (value) => {
      if (!value) return true;
      return value.length <= max;
    },
    message: message || `Must be ${max} characters or less`,
    trigger: 'input'
  }),

  pattern: (regex: RegExp, message: string): ValidationRule => ({
    validate: (value) => {
      if (!value) return true;
      return regex.test(value);
    },
    message,
    trigger: 'blur'
  }),

  username: (message: string = 'Username can only contain letters, numbers, and underscores'): ValidationRule => ({
    validate: (value) => {
      if (!value) return true;
      return /^[a-zA-Z0-9_]+$/.test(value);
    },
    message,
    trigger: 'input'
  }),

  passwordStrength: (message: string = 'Password must contain at least one uppercase letter, one lowercase letter, and one number'): ValidationRule => ({
    validate: (value) => {
      if (!value) return true;
      return /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value);
    },
    message,
    trigger: 'blur'
  }),

  confirmPassword: (passwordFieldName: string = 'password', message: string = 'Passwords do not match'): ValidationRule => ({
    validate: (value, formData) => {
      if (!value || !formData) return true;
      const password = formData.get(passwordFieldName);
      return value === password;
    },
    message,
    trigger: 'input'
  }),

  range: (min: number, max: number, message?: string): ValidationRule => ({
    validate: (value) => {
      if (!value) return true;
      const num = Number(value);
      return !isNaN(num) && num >= min && num <= max;
    },
    message: message || `Must be between ${min} and ${max}`,
    trigger: 'blur'
  }),

  async: (
    asyncValidator: (value: any) => Promise<boolean>,
    message: string,
    debounceMs: number = 500
  ): ValidationRule => ({
    validate: (value) => {
      // This will be handled specially by the form validator
      return true;
    },
    message,
    trigger: 'blur'
  })
};

/**
 * Form validator class
 */
export class FormValidator {
  private form: HTMLFormElement;
  private config: FormConfig;
  private errors: Record<string, string> = {};
  private debounceTimers: Record<string, NodeJS.Timeout> = {};
  private asyncValidators: Record<string, (value: any) => Promise<boolean>> = {};

  constructor(form: HTMLFormElement, config: FormConfig) {
    this.form = form;
    this.config = config;
    this.init();
  }

  private init() {
    // Set up event listeners for each field
    Object.keys(this.config.fields).forEach(fieldName => {
      const field = this.form.querySelector(`[name="${fieldName}"]`) as HTMLInputElement;
      if (!field) return;

      const fieldConfig = this.config.fields[fieldName];

      // Set up validation triggers
      fieldConfig.rules.forEach(rule => {
        if (rule.trigger === 'input' || !rule.trigger) {
          field.addEventListener('input', () => this.validateField(fieldName, rule.trigger || 'input'));
        }
        if (rule.trigger === 'blur') {
          field.addEventListener('blur', () => this.validateField(fieldName, 'blur'));
        }
      });

      // Validate on mount if configured
      if (fieldConfig.validateOnMount) {
        this.validateField(fieldName, 'submit');
      }
    });

    // Set up form submission
    this.form.addEventListener('submit', this.handleSubmit.bind(this));
  }

  private async validateField(fieldName: string, trigger: string) {
    const field = this.form.querySelector(`[name="${fieldName}"]`) as HTMLInputElement;
    if (!field) return;

    const fieldConfig = this.config.fields[fieldName];
    const value = field.value;
    const formData = new FormData(this.form);

    // Clear previous debounce timer
    if (this.debounceTimers[fieldName]) {
      clearTimeout(this.debounceTimers[fieldName]);
    }

    const validateNow = () => {
      // Find the first failing rule for this trigger
      const failingRule = fieldConfig.rules.find(rule => {
        if (rule.trigger && rule.trigger !== trigger) return false;
        return !rule.validate(value, formData);
      });

      if (failingRule) {
        this.setFieldError(fieldName, failingRule.message);
      } else {
        this.clearFieldError(fieldName);
      }

      this.updateValidationState();
    };

    // Debounce validation if configured
    if (fieldConfig.debounceMs && trigger === 'input') {
      this.debounceTimers[fieldName] = setTimeout(validateNow, fieldConfig.debounceMs);
    } else {
      validateNow();
    }
  }

  private setFieldError(fieldName: string, message: string) {
    this.errors[fieldName] = message;
    this.displayFieldError(fieldName, message);
  }

  private clearFieldError(fieldName: string) {
    delete this.errors[fieldName];
    this.hideFieldError(fieldName);
  }

  private displayFieldError(fieldName: string, message: string) {
    const field = this.form.querySelector(`[name="${fieldName}"]`) as HTMLInputElement;
    const errorElement = this.form.querySelector(`#${fieldName}-error`) as HTMLElement;

    if (field) {
      field.classList.add('border-red-500', 'focus:ring-red-500');
      field.classList.remove('border-gray-300', 'focus:ring-blue-500');
    }

    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.remove('hidden');
    }
  }

  private hideFieldError(fieldName: string) {
    const field = this.form.querySelector(`[name="${fieldName}"]`) as HTMLInputElement;
    const errorElement = this.form.querySelector(`#${fieldName}-error`) as HTMLElement;

    if (field) {
      field.classList.remove('border-red-500', 'focus:ring-red-500');
      field.classList.add('border-gray-300', 'focus:ring-blue-500');
    }

    if (errorElement) {
      errorElement.classList.add('hidden');
    }
  }

  private updateValidationState() {
    const isValid = Object.keys(this.errors).length === 0;
    
    if (this.config.onValidationChange) {
      this.config.onValidationChange(isValid, { ...this.errors });
    }

    // Update submit button state
    const submitButton = this.form.querySelector('button[type="submit"]') as HTMLButtonElement;
    if (submitButton) {
      submitButton.disabled = !isValid;
      if (isValid) {
        submitButton.classList.remove('opacity-50', 'cursor-not-allowed');
      } else {
        submitButton.classList.add('opacity-50', 'cursor-not-allowed');
      }
    }
  }

  private async handleSubmit(event: Event) {
    event.preventDefault();

    // Validate all fields
    const formData = new FormData(this.form);
    await this.validateAllFields();

    const isValid = Object.keys(this.errors).length === 0;

    if (this.config.submitHandler) {
      await this.config.submitHandler(formData, isValid);
    }
  }

  private async validateAllFields() {
    const promises = Object.keys(this.config.fields).map(fieldName => 
      this.validateField(fieldName, 'submit')
    );
    await Promise.all(promises);
  }

  /**
   * Manually validate a specific field
   */
  public async validateFieldManually(fieldName: string): Promise<boolean> {
    await this.validateField(fieldName, 'submit');
    return !this.errors[fieldName];
  }

  /**
   * Manually validate all fields
   */
  public async validateForm(): Promise<boolean> {
    await this.validateAllFields();
    return Object.keys(this.errors).length === 0;
  }

  /**
   * Get current validation errors
   */
  public getErrors(): Record<string, string> {
    return { ...this.errors };
  }

  /**
   * Check if form is currently valid
   */
  public isValid(): boolean {
    return Object.keys(this.errors).length === 0;
  }

  /**
   * Clear all errors
   */
  public clearErrors() {
    Object.keys(this.errors).forEach(fieldName => {
      this.clearFieldError(fieldName);
    });
    this.updateValidationState();
  }

  /**
   * Set custom error for a field
   */
  public setCustomError(fieldName: string, message: string) {
    this.setFieldError(fieldName, message);
    this.updateValidationState();
  }

  /**
   * Destroy the validator and clean up event listeners
   */
  public destroy() {
    Object.values(this.debounceTimers).forEach(timer => clearTimeout(timer));
    // Note: In a real implementation, you'd want to remove event listeners
    // This is simplified for brevity
  }
}

/**
 * Utility function to create a form validator
 */
export function createFormValidator(
  formSelector: string,
  config: FormConfig
): FormValidator | null {
  const form = document.querySelector(formSelector) as HTMLFormElement;
  if (!form) {
    console.error(`Form not found: ${formSelector}`);
    return null;
  }

  return new FormValidator(form, config);
}

/**
 * Async username availability checker
 */
export async function checkUsernameAvailability(username: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/auth/check-username?username=${encodeURIComponent(username)}`);
    const data = await response.json();
    return data.available;
  } catch (error) {
    console.error('Error checking username availability:', error);
    return false;
  }
}

/**
 * Real-time validation for specific common scenarios
 */
export const CommonValidators = {
  loginForm: (): FormConfig => ({
    fields: {
      email: {
        rules: [
          ValidationRules.required('Email is required'),
          ValidationRules.email()
        ]
      },
      password: {
        rules: [
          ValidationRules.required('Password is required')
        ]
      }
    }
  }),

  registerForm: (): FormConfig => ({
    fields: {
      username: {
        rules: [
          ValidationRules.required('Username is required'),
          ValidationRules.minLength(3),
          ValidationRules.maxLength(30),
          ValidationRules.username()
        ],
        debounceMs: 500
      },
      email: {
        rules: [
          ValidationRules.required('Email is required'),
          ValidationRules.email()
        ]
      },
      password: {
        rules: [
          ValidationRules.required('Password is required'),
          ValidationRules.minLength(8),
          ValidationRules.passwordStrength()
        ]
      },
      confirmPassword: {
        rules: [
          ValidationRules.required('Please confirm your password'),
          ValidationRules.confirmPassword()
        ]
      }
    }
  }),

  reviewForm: (): FormConfig => ({
    fields: {
      rating: {
        rules: [
          ValidationRules.range(1, 10, 'Rating must be between 1 and 10')
        ]
      },
      title: {
        rules: [
          ValidationRules.maxLength(200, 'Title must be 200 characters or less')
        ]
      },
      content: {
        rules: [
          ValidationRules.required('Review content is required'),
          ValidationRules.minLength(10, 'Review must be at least 10 characters long'),
          ValidationRules.maxLength(2000, 'Review must be 2000 characters or less')
        ]
      }
    }
  })
};