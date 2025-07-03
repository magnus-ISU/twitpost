// Twitter Auto-Expand Content Script - Chrome Optimized
;(function () {
	'use strict'

	// Configuration
	const CONFIG = {
		clickDelay: 300,
		debounceDelay: 200,
		maxProcessPerBatch: 5,
		intersectionThreshold: 0.1,
	}

	// Performance optimizations
	const processedButtons = new WeakSet()
	const pendingButtons = new Set()
	let debounceTimer = null
	let isProcessing = false
	let observer = null
	let intersectionObserver = null

	// Cached selectors
	const BUTTON_SELECTOR = 'button[data-testid="tweet-text-show-more-link"]'

	/**
	 * Setup Intersection Observer for visibility detection
	 */
	function setupIntersectionObserver() {
		if (intersectionObserver) return

		intersectionObserver = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting && pendingButtons.has(entry.target)) {
						pendingButtons.delete(entry.target)
						processButton(entry.target)
					}
				})
			},
			{
				threshold: CONFIG.intersectionThreshold,
				rootMargin: '100px',
			},
		)
	}

	/**
	 * Fast button validation
	 */
	function isValidShowMoreButton(button) {
		if (!button?.isConnected || processedButtons.has(button)) {
			return false
		}

		if (button.dataset.testid !== 'tweet-text-show-more-link') {
			return false
		}

		const style = button.style
		if (style.display === 'none' || style.visibility === 'hidden') {
			return false
		}

		const text = button.textContent
		if (!text?.includes('Show more')) {
			return false
		}

		return true
	}

	/**
	 * Find closest tweet container efficiently
	 */
	function findTweetContainer(element) {
		let current = element.parentElement
		let depth = 0
		const maxDepth = 10

		while (current && depth < maxDepth) {
			if (current.dataset?.testid === 'tweet' || (current.tagName === 'ARTICLE' && current.getAttribute('role') === 'article')) {
				return current
			}
			current = current.parentElement
			depth++
		}
		return null
	}

	/**
	 * Process a single button
	 */
	function processButton(button) {
		if (!isValidShowMoreButton(button)) {
			return
		}

		processedButtons.add(button)

		if (!findTweetContainer(button)) {
			return
		}

		setTimeout(() => {
			try {
				if (button.isConnected && !button.disabled) {
					button.click()
					console.log('Twitter Auto-Expand: Expanded post')
				}
			} catch (error) {
				console.error('Twitter Auto-Expand: Click error:', error)
			}
		}, CONFIG.clickDelay)
	}

	/**
	 * Batch process buttons using requestIdleCallback
	 */
	function processPendingButtons() {
		if (isProcessing) return
		isProcessing = true

		const buttons = Array.from(pendingButtons).slice(0, CONFIG.maxProcessPerBatch)
		pendingButtons.clear()

		const processFunction = () => {
			buttons.forEach((button) => {
				if (button.isConnected) {
					intersectionObserver.observe(button)
				}
			})
			isProcessing = false
		}

		requestIdleCallback(processFunction, { timeout: 1000 })
	}

	/**
	 * Find new buttons efficiently
	 */
	function findNewButtons() {
		const buttons = document.querySelectorAll(BUTTON_SELECTOR)

		let newButtonCount = 0
		for (const button of buttons) {
			if (!processedButtons.has(button) && isValidShowMoreButton(button)) {
				pendingButtons.add(button)
				newButtonCount++
			}
		}

		if (newButtonCount > 0) {
			processPendingButtons()
		}

		return newButtonCount
	}

	/**
	 * Debounced expansion function
	 */
	function debouncedExpand() {
		clearTimeout(debounceTimer)
		debounceTimer = setTimeout(findNewButtons, CONFIG.debounceDelay)
	}

	/**
	 * Setup MutationObserver for DOM changes
	 */
	function setupMutationObserver() {
		if (observer) return

		observer = new MutationObserver((mutations) => {
			let shouldProcess = false

			for (const mutation of mutations) {
				if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
					for (const node of mutation.addedNodes) {
						if (node.nodeType === Node.ELEMENT_NODE) {
							if (node.dataset?.testid?.includes('tweet') || node.querySelector?.(BUTTON_SELECTOR) || node.matches?.('[data-testid="tweet"], article[role="article"]')) {
								shouldProcess = true
								break
							}
						}
					}
					if (shouldProcess) break
				}
			}

			if (shouldProcess) {
				debouncedExpand()
			}
		})

		observer.observe(document.body, {
			childList: true,
			subtree: true,
		})
	}

	/**
	 * Handle page navigation
	 */
	let currentUrl = location.href
	function handleNavigation() {
		const newUrl = location.href
		if (newUrl !== currentUrl) {
			currentUrl = newUrl
			setTimeout(findNewButtons, 800)
		}
	}

	/**
	 * Initialize extension
	 */
	function initialize() {
		console.log('Twitter Auto-Expand: Initializing Chrome optimized version')

		setupIntersectionObserver()
		setupMutationObserver()

		setTimeout(() => {
			const found = findNewButtons()
			console.log(`Twitter Auto-Expand: Found ${found} buttons on initial scan`)
		}, 1000)

		const navObserver = new MutationObserver(handleNavigation)
		navObserver.observe(document.body, {
			childList: true,
			subtree: false,
		})

		setInterval(() => {
			pendingButtons.forEach((button) => {
				if (!button.isConnected) {
					pendingButtons.delete(button)
				}
			})
			findNewButtons()
		}, 5000)

		console.log('Twitter Auto-Expand: Initialization complete')
	}

	/**
	 * Cleanup observers
	 */
	function cleanup() {
		observer?.disconnect()
		intersectionObserver?.disconnect()
		clearTimeout(debounceTimer)
	}

	addEventListener('beforeunload', cleanup)

	if (document.readyState === 'loading') {
		addEventListener('DOMContentLoaded', initialize)
	} else {
		initialize()
	}
})()
