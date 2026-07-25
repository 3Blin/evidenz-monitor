/**
 * RSS-/Atom-Adapter. Zweck: Der wichtigste offene Zugangsweg - deckt
 * Reddit-Feeds, Foren, Fachmedien und Herstellerseiten gleichermaßen ab.
 */
import Parser from "rss-parser";
import { auszugBilden, type QuellenAdapter, type RohInhalt } from "./adapter";

const parser = new Parser({ timeout: 10000 });

export const rssAdapter: QuellenAdapter = {
  name: "rss",
  async abrufen(url: string): Promise<readonly RohInhalt[]> {
    const feed = await parser.parseURL(url);
    return (feed.items ?? [])
      .filter((item) => Boolean(item.link && item.title))
      .map((item) => ({
        url: String(item.link),
        titel: String(item.title),
        autor: item.creator ?? item.author ?? null,
        veroeffentlichtAm: item.isoDate ? new Date(item.isoDate) : null,
        auszug: auszugBilden(item.contentSnippet ?? item.content ?? String(item.title)),
      }));
  },
};
