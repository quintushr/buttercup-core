import { BaseSearch, ProcessedSearchEntry, SearcherFactory } from "./BaseSearch.js";
import { EntryURLType, getEntryURLs } from "../tools/entry.js";
import { fieldsToProperties } from "../facades/entry.js";
import { StorageInterface } from "../storage/StorageInterface.js";
import { EntryFacade, VaultFacade } from "../types.js";

async function extractEntries(
    facade: VaultFacade,
    memory: StorageInterface
): Promise<Array<ProcessedSearchEntry>> {
    // Get scores
    const scoresRaw = await memory.getValue(`bcup_search_${facade.id}`);
    let vaultScore = {};
    if (scoresRaw) {
        try {
            const scores = JSON.parse(scoresRaw);
            vaultScore = scores;
        } catch (err) {}
    }
    // Get entries
    return facade.entries.reduce((entries: Array<ProcessedSearchEntry>, nextEntry: EntryFacade) => {
        // @todo in trash
        const properties = fieldsToProperties(nextEntry.fields);
        const urls = getEntryURLs(properties, EntryURLType.General);
        entries.push({
            id: nextEntry.id,
            properties,
            entryType: nextEntry.type,
            urls,
            groupID: nextEntry.parentID,
            vaultID: facade.id,
            domainScores: vaultScore[nextEntry.id] || {}
        });
        return entries;
    }, []);
}

export class VaultFacadeEntrySearch extends BaseSearch {
    constructor(
        facades: Array<VaultFacade>,
        memory?: StorageInterface,
        searcherFactory?: SearcherFactory
    ) {
        super(facades, extractEntries, memory, searcherFactory);
    }
}
