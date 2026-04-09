const { useState, useEffect, useRef } = require('react');

/**
 * A debounce hook that delays updating a value until after a specified wait.
 * Also exposes a flush() method and tracks whether a debounce is pending.
 * Tests need fake timers and act() to verify timing behavior.
 */

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const [isPending, setIsPending] = useState(false);
  const timeoutRef = useRef(null);
  const latestValueRef = useRef(value);

  latestValueRef.current = value;

  useEffect(() => {
    if (value === debouncedValue && !isPending) return;

    setIsPending(true);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(latestValueRef.current);
      setIsPending(false);
      timeoutRef.current = null;
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [value, delay]);

  const flush = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setDebouncedValue(latestValueRef.current);
    setIsPending(false);
  };

  return { value: debouncedValue, isPending, flush };
}

module.exports = { useDebounce };
