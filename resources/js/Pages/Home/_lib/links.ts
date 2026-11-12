/** A user-defined home-screen link (persisted in localStorage + account settings). */
export interface CustomLink {
  id: string;
  name: string;
  url: string;
  icon?: string;
}
