export interface PlexTvUser {
  id?: string;
  username?: string;
  thumb?: string;
}

const attribute = (element: string, name: string): string | undefined =>
  new RegExp(`\\s${name}="([^"]*)"`).exec(element)?.[1];

export const parsePlexTvUsers = (xml: string): PlexTvUser[] =>
  (xml.match(/<User[^>]*>/g) ?? []).map((element) => ({
    id: attribute(element, 'id'),
    username:
      attribute(element, 'username') ||
      attribute(element, 'title') ||
      attribute(element, 'friendlyName'),
    thumb: attribute(element, 'thumb'),
  }));
