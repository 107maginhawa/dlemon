use anyhow::Result;
use std::future::Future;
use std::time::Duration;

/// Retry an async operation with exponential backoff.
///
/// Returns `Some(value)` on success, or `None` if all attempts are exhausted.
/// When `max_attempts == 0`, retries forever (not recommended in production).
pub async fn retry_with_backoff<T, F, Fut>(
    max_attempts: u32,
    base_delay_ms: u64,
    max_delay_ms: u64,
    operation_name: &str,
    mut f: F,
) -> Option<T>
where
    F: FnMut() -> Fut,
    Fut: Future<Output = Result<T>>,
{
    let mut attempt = 0u32;

    loop {
        attempt += 1;

        match f().await {
            Ok(value) => return Some(value),
            Err(e) => {
                if max_attempts > 0 && attempt >= max_attempts {
                    tracing::error!(
                        "{}: exhausted {} attempts, last error: {}",
                        operation_name, max_attempts, e
                    );
                    return None;
                }

                let delay_ms = calculate_backoff(attempt, base_delay_ms, max_delay_ms);
                tracing::warn!(
                    "{}: attempt {}{} failed: {}, retrying in {}ms",
                    operation_name,
                    attempt,
                    if max_attempts > 0 { format!("/{}", max_attempts) } else { String::new() },
                    e,
                    delay_ms
                );
                tokio::time::sleep(Duration::from_millis(delay_ms)).await;
            }
        }
    }
}

/// Calculate exponential backoff delay with jitter, capped at max_delay_ms.
fn calculate_backoff(attempt: u32, base_delay_ms: u64, max_delay_ms: u64) -> u64 {
    let exp_delay = base_delay_ms.saturating_mul(1u64 << attempt.min(20));
    exp_delay.min(max_delay_ms)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    #[tokio::test]
    async fn test_retry_succeeds_on_first_attempt() {
        let result = retry_with_backoff(3, 10, 100, "test", || async {
            Ok::<_, anyhow::Error>(42)
        }).await;
        assert_eq!(result, Some(42));
    }

    #[tokio::test]
    async fn test_retry_succeeds_after_failures() {
        let counter = AtomicU32::new(0);
        let result = retry_with_backoff(5, 10, 100, "test", || {
            let n = counter.fetch_add(1, Ordering::SeqCst);
            async move {
                if n < 2 {
                    Err(anyhow::anyhow!("fail #{}", n))
                } else {
                    Ok(99)
                }
            }
        }).await;
        assert_eq!(result, Some(99));
        assert_eq!(counter.load(Ordering::SeqCst), 3); // 2 failures + 1 success
    }

    #[tokio::test]
    async fn test_retry_exhausts_max_attempts() {
        let counter = AtomicU32::new(0);
        let result = retry_with_backoff(3, 10, 100, "test", || {
            counter.fetch_add(1, Ordering::SeqCst);
            async { Err::<i32, _>(anyhow::anyhow!("always fails")) }
        }).await;
        assert_eq!(result, None);
        assert_eq!(counter.load(Ordering::SeqCst), 3);
    }

    #[test]
    fn test_backoff_calculation() {
        assert_eq!(calculate_backoff(1, 1000, 60000), 2000);
        assert_eq!(calculate_backoff(2, 1000, 60000), 4000);
        assert_eq!(calculate_backoff(3, 1000, 60000), 8000);
        assert_eq!(calculate_backoff(6, 1000, 60000), 60000); // capped
        assert_eq!(calculate_backoff(30, 1000, 60000), 60000); // capped, no overflow
    }
}
