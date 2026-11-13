import popupFacts from '../../../data/site-popup.json';

/** The homepage popup's copy, as `SiteSetting` stores it and the admin form edits it. */
export interface SitePopup {
    enabled: boolean;
    title: string;
    description: string;
    buttonText: string;
    dismissText: string;
    link: string;
    version: number;
}

/**
 * The copy ships in `resources/data/site-popup.json`, which `SiteSetting::defaults()`
 * reads too: the server prop overrides it, the file keeps the two in step.
 */
export const SITE_POPUP_DEFAULTS: SitePopup = popupFacts;
