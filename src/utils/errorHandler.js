/**
 * errorHandler.js — Enterprise Client-Side Error Handler & Utilities
 * Integrates with crashReporter and Toast notifications.
 */

import { reportCrash } from '../services/crashReporter.js';

/**
 * Format any thrown error into a human-readable string
 * @param {any} error
 * @param {string} [fallback='An unexpected error occurred. Please try again.']
 * @returns {string}
 */
export function formatErrorMessage(error, fallback = 'An unexpected error occurred. Please try again.') {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (error.response?.data?.error) return error.response.data.error;
  if (error.response?.data?.message) return error.response.data.message;
  if (error.message) {
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      return 'Network connection issue. Please check your internet connection and try again.';
    }
    return error.message;
  }
  return fallback;
}

/**
 * Handle API or component error gracefully
 * @param {any} error
 * @param {object} [options]
 * @param {string} [options.fallbackMessage]
 * @param {Function} [options.showToast] - toast callback: (msg, type) => void
 * @param {boolean} [options.report=false] - whether to report to crashReporter
 * @param {string} [options.context='UI']
 * @returns {string} The formatted error message
 */
export function handleApiError(error, options = {}) {
  const {
    fallbackMessage = 'Operation failed. Please try again.',
    showToast = null,
    report = false,
    context = 'General'
  } = options;

  const message = formatErrorMessage(error, fallbackMessage);

  if (report) {
    reportCrash(error instanceof Error ? error : new Error(message), {
      context,
      message
    });
  }

  if (showToast && typeof showToast === 'function') {
    showToast(message, 'error');
  }

  return message;
}

/**
 * Safe async executor that never unhandled-rejects
 * @template T
 * @param {Promise<T>|(() => Promise<T>)} task
 * @param {T|null} [fallback=null]
 * @returns {Promise<[T|null, Error|null]>} [result, error]
 */
export async function safeAsync(task, fallback = null) {
  try {
    const fn = typeof task === 'function' ? task() : task;
    const result = await fn;
    return [result, null];
  } catch (error) {
    return [fallback, error instanceof Error ? error : new Error(String(error))];
  }
}
