// Twitter Auto-Expand Content Script
;(function () {
	'use strict'

	// Configuration
	const CONFIG = {
		// Delay before clicking (to avoid being too aggressive)
		clickDelay: 500,
		// How often to check for new "Show more" buttons
		checkInterval: 1000,
		// Debounce delay for mutation observer
		debounceDelay: 300,
	}

	// Keep track of processed buttons to avoid duplicate clicks
	const processedButtons = new WeakSet()
	let debounceTimeout

	/**
	 * Check if this is actually a "Show more" button for truncated text
	 */
	function isShowMoreButton(button) {
		if (!button || !button.isConnected) {
			return false
		}

		// Must have the specific test ID for tweet text expansion
		if (button.getAttribute('data-testid') !== 'tweet-text-show-more-link') {
			return false
		}

		// Check if it contains "Show more" text
		const buttonText = button.textContent?.trim().toLowerCase()
		if (!buttonText || !buttonText.includes('show more')) {
			return false
		}

		// Verify it's actually visible and clickable
		if (!isElementVisible(button)) {
			return false
		}

		// Additional check: make sure it's within a tweet context
		const tweetContainer = button.closest('[data-testid="tweet"]') || button.closest('[data-testid="tweetText"]') || button.closest('article[role="article"]')

		if (!tweetContainer) {
			return false
		}

		return true
	}

	/**
	 * Check if an element is visible and clickable
	 */
	function isElementVisible(element) {
		if (!element || !element.isConnected) {
			return false
		}

		const style = window.getComputedStyle(element)
		const rect = element.getBoundingClientRect()

		return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && rect.width > 0 && rect.height > 0 && !element.disabled && !element.hasAttribute('aria-hidden')
	}

	/**
	 * Find and click legitimate "Show more" buttons
	 */
	function expandTruncatedPosts() {
		// Use very specific selector to avoid false positives
		const buttons = document.querySelectorAll('button[data-testid="tweet-text-show-more-link"]')

		let clickedCount = 0

		buttons.forEach((button) => {
			// Skip if already processed
			if (processedButtons.has(button)) {
				return
			}

			// Thorough validation
			if (!isShowMoreButton(button)) {
				return
			}

			// Mark as processed immediately to prevent double-clicking
			processedButtons.add(button)

			// Click with delay to appear natural and avoid rapid-fire clicking
			setTimeout(() => {
				try {
					// Double-check the button is still valid before clicking
					if (button.isConnected && isShowMoreButton(button)) {
						button.click()
						clickedCount++
						console.log('Twitter Auto-Expand: Expanded truncated post')
					}
				} catch (error) {
					console.error('Twitter Auto-Expand: Error expanding post:', error)
				}
			}, CONFIG.clickDelay + clickedCount * 100) // Stagger clicks if multiple buttons
		})

		if (clickedCount > 0) {
			console.log(`Twitter Auto-Expand: Processed ${clickedCount} truncated posts`)
		}
	}

	/**
	 * Debounced function to handle DOM changes
	 */
	function debouncedExpand() {
		clearTimeout(debounceTimeout)
		debounceTimeout = setTimeout(expandTruncatedPosts, CONFIG.debounceDelay)
	}

	/**
	 * Check if mutation is relevant (contains tweet-related content)
	 */
	function isRelevantMutation(mutation) {
		if (mutation.type !== 'childList' || mutation.addedNodes.length === 0) {
			return false
		}

		for (const node of mutation.addedNodes) {
			if (node.nodeType === Node.ELEMENT_NODE) {
				// Check if the added node or its children contain tweet content
				if (node.querySelector && (node.querySelector('[data-testid="tweet-text-show-more-link"]') || node.querySelector('[data-testid="tweet"]') || node.querySelector('article[role="article"]') || node.matches('[data-testid="tweet"]') || node.matches('article[role="article"]'))) {
					return true
				}
			}
		}

		return false
	}

	/**
	 * Initialize the extension
	 */
	function initialize() {
		console.log('Twitter Auto-Expand: Starting extension')

		// Initial check after page load
		setTimeout(expandTruncatedPosts, 1000)

		// Set up MutationObserver to watch for new tweets
		const observer = new MutationObserver((mutations) => {
			const hasRelevantChanges = mutations.some(isRelevantMutation)

			if (hasRelevantChanges) {
				debouncedExpand()
			}
		})

		// Start observing with minimal scope
		observer.observe(document.body, {
			childList: true,
			subtree: true,
		})

		// Periodic check as backup (less frequent)
		setInterval(expandTruncatedPosts, CONFIG.checkInterval * 3)

		console.log('Twitter Auto-Expand: Extension initialized')
	}

	// Handle page navigation in single-page apps
	let currentPath = location.pathname
	function handleNavigation() {
		if (location.pathname !== currentPath) {
			currentPath = location.pathname
			console.log('Twitter Auto-Expand: Page navigation detected')
			// Wait for new content to load
			setTimeout(expandTruncatedPosts, 1500)
		}
	}

	// Listen for navigation changes
	const navObserver = new MutationObserver(handleNavigation)
	navObserver.observe(document.body, { childList: true, subtree: true })

	// Initialize when DOM is ready
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initialize)
	} else {
		initialize()
	}
})()
