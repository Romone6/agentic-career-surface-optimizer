export interface LinkedInSelector {
  id: string;
  selector: string;
  description: string;
  fallback?: string[];
}

export const LinkedInSelectors = {
  headline: {
    container: {
      id: 'headline-container',
      selector: '.pv-text-details__left-panel',
      description: 'Headline section container on profile page',
      fallback: [
        '.pv-text-details__left-panel',
        '[data-test-id="headline"]',
        '.text-body-medium.break-words',
      ],
    },
    editButton: {
      id: 'headline-edit-btn',
      selector: 'button[aria-label="Edit headline"]',
      description: 'Edit button for headline section',
      fallback: [
        'button[aria-label="Edit headline"]',
        '.pv-text-details__left-panel button',
        'button:has-text("Edit headline")',
      ],
    },
    textArea: {
      id: 'headline-textarea',
      selector: 'textarea#headline',
      description: 'Textarea for editing headline',
      fallback: [
        'textarea#headline',
        'textarea[name="headline"]',
        '[data-test-text="headline-textarea"]',
      ],
    },
    saveButton: {
      id: 'headline-save-btn',
      selector: 'button[aria-label="Save"]',
      description: 'Save button for headline',
      fallback: [
        'button[aria-label="Save"]',
        'button:has-text("Save")',
        '.pv-text-details__left-panel button[type="submit"]',
      ],
    },
    displayText: {
      id: 'headline-display',
      selector: '.text-body-medium.break-words',
      description: 'Headline display text on profile',
      fallback: [
        '.text-body-medium.break-words',
        '[data-test-id="headline"] .visually-hidden',
      ],
    },
  },

  about: {
    container: {
      id: 'about-container',
      selector: '.pv-text-details__left-panel:has-text("About")',
      description: 'About section container',
      fallback: [
        '.pv-text-details__left-panel:has-text("About")',
        '[data-test-id="about"]',
        '.about-section',
      ],
    },
    editButton: {
      id: 'about-edit-btn',
      selector: 'button[aria-label="Edit about"]',
      description: 'Edit button for about section',
      fallback: [
        'button[aria-label="Edit about"]',
        'button:has-text("Edit about")',
        '.about-section button',
      ],
    },
    textArea: {
      id: 'about-textarea',
      selector: 'textarea#about',
      description: 'Textarea for editing about section',
      fallback: [
        'textarea#about',
        'textarea[name="about"]',
        '[data-test-text="about-textarea"]',
      ],
    },
    saveButton: {
      id: 'about-save-btn',
      selector: 'button[aria-label="Save"]',
      description: 'Save button for about section',
      fallback: [
        'button[aria-label="Save"]',
        'button:has-text("Save")',
        '.about-section button[type="submit"]',
      ],
    },
    displayText: {
      id: 'about-display',
      selector: '.inline-show-more-text--has-controls',
      description: 'About section display text',
      fallback: [
        '.inline-show-more-text--has-controls',
        '[data-test-id="about"] .visually-hidden',
      ],
    },
  },

  profile: {
    navItem: {
      id: 'profile-nav-item',
      selector: 'a[href*="/in/"]',
      description: 'Profile navigation item',
      fallback: [
        'a[href*="/in/"]',
        '.global-nav__me-photo',
        '[data-test-nav-item="profile"]',
      ],
    },
    headlineSection: {
      id: 'headline-section',
      selector: '.ph5',
      description: 'Main profile content area',
      fallback: [
        '.ph5',
        '.pv-text-details__left-panel',
        '#profile',
      ],
    },
  },

  modal: {
    overlay: {
      id: 'modal-overlay',
      selector: '.artdeco-modal-overlay',
      description: 'Modal overlay for edit dialog',
      fallback: [
        '.artdeco-modal-overlay',
        '[role="dialog"]',
        '.modal',
      ],
    },
    dismissButton: {
      id: 'modal-dismiss',
      selector: 'button[aria-label="Dismiss"]',
      description: 'Dismiss button for modals',
      fallback: [
        'button[aria-label="Dismiss"]',
        'button.artdeco-modal__dismiss',
        'button:has-text("×")',
      ],
    },
  },
};

export function getSelectorWithFallback(
  selectorConfig: LinkedInSelector
): string {
  const selectors = [selectorConfig.selector, ...(selectorConfig.fallback || [])];
  return selectors.join(', ');
}

export function buildSelectorChain(
  baseSelector: string,
  childSelector: string
): string {
  return `${baseSelector} ${childSelector}`;
}
