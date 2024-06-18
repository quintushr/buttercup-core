import { consumeEntryFacade, createEntryFacade } from "./entry.js";
import { idSignifiesNew } from "./tools.js";
import { FACADE_VERSION } from "./symbols.js";
import { Entry } from "../core/Entry.js";
import { Group } from "../core/Group.js";
import { Vault } from "../core/Vault.js";
import { generateUUID } from "../tools/uuid.js";
import { EntryFacade, GroupFacade, GroupID, VaultFacade } from "../types.js";

export interface ConsumeVaultFacadeOptions {
    mergeMode?: boolean;
}

export interface CreateVaultFacadeOptions {
    includeTrash?: boolean;
}

export interface GetGroupEntriesFacadesOptions {
    includeTrash?: boolean;
}

export interface GetGroupsFacadesOptions {
    includeTrash?: boolean;
}

const { FacadeType } = Entry.Attributes;

/**
 * Consume a group facade and apply the differences to a group instance
 * @param group The group instance to apply to
 * @param facade The facade to apply
 * @memberof module:Buttercup
 */
export function consumeGroupFacade(group: Group, facade: GroupFacade) {
    const { id, title, type, attributes } = facade;
    const existingAttributes = group.getAttribute();
    if (type !== "group") {
        throw new Error(`Failed consuming group facade: Invalid facade type: ${type}`);
    }
    if (id !== group.id) {
        throw new Error(
            `Failed consuming group facade: Provided facade ID (${id}) does not match target group's ID: ${group.id}`
        );
    }
    if (!title || title.trim().length <= 0) {
        throw new Error("Failed consuming group facade: Title must not be empty");
    }
    if (group.getTitle() !== title) {
        group.setTitle(title);
    }
    // Check attributes
    Object.keys(existingAttributes)
        .filter((attr) => !attributes.hasOwnProperty(attr))
        .forEach((attr) => {
            // Remove missing
            group.deleteAttribute(attr);
        });
    Object.keys(attributes).forEach((attr) => {
        if (!existingAttributes[attr] || existingAttributes[attr] !== attributes[attr]) {
            // Different value
            group.setAttribute(attr, attributes[attr]);
        }
    });
}

/**
 * Consume a vault facade and apply the differences to the vault instance.
 * @param {Vault} vault - The vault instance to apply to.
 * @param {VaultFacade} facade - The facade to apply.
 * @param {ConsumeVaultFacadeOptions} options - Options for the consumption.
 * @memberof module:Buttercup
 */
export function consumeVaultFacade(
    vault: Vault,
    facade: VaultFacade,
    options: ConsumeVaultFacadeOptions = {}
) {
    if (!facade || facade._ver !== FACADE_VERSION) {
        throw new Error("Invalid or incompatible vault facade version");
    }
    if (facade.type !== "vault") {
        throw new Error(`Failed consuming vault facade: Expected facade type "vault", got: ${facade.type}`);
    }

    const { mergeMode = false } = options;
    const { id, attributes, groups, entries } = facade;

    if (!mergeMode && id !== vault.id) {
        throw new Error(`Failed consuming vault facade: Facade ID (${id}) does not match vault ID (${vault.id})`);
    }

    const newIDLookup = {};

    // Create comparison facade
    let { groups: currentGroups, entries: currentEntries, attributes: currentAttributes } = createVaultFacade(vault);

    function handleGroupRemoval() {
        if (!mergeMode) {
            currentGroups.forEach((currentGroupFacade) => {
                if (!groups.some(group => group.id === currentGroupFacade.id)) {
                    const targetGroup = vault.findGroupByID(currentGroupFacade.id);
                    if (targetGroup) targetGroup.delete();
                }
            });
        }
    }

    function processGroups() {
        let groupsLeft = [...groups];
        while (groupsLeft.length > 0) {
            const originalLength = groupsLeft.length;
            groupsLeft = groupsLeft.filter((groupRaw) => {
                const groupFacade = { ...groupRaw };
                const groupIDTargetedNew = idSignifiesNew(groupFacade.id, mergeMode);

                if (!groupFacade.id || groupIDTargetedNew) {
                    let targetParentID = groupFacade.parentID;
                    if (idSignifiesNew

(targetParentID, mergeMode)) {
                        targetParentID = newIDLookup[targetParentID] || targetParentID;
                    }

                    const targetParent = targetParentID === "0" ? vault : vault.findGroupByID(targetParentID);
                    if (targetParent) {
                        const newGroupInst = targetParent.createGroup(groupFacade.title);
                        if (groupIDTargetedNew) {
                            newIDLookup[groupFacade.id] = newGroupInst.id;
                        }
                        groupFacade.id = newGroupInst.id;
                    } else {
                        return true; // Parent not ready, stall this group
                    }
                } else {
                    const refGroup = vault.findGroupByID(groupFacade.id);
                    const refGroupParent = refGroup.getParentGroup();
                    if ((refGroupParent === null && groupFacade.parentID !== "0") ||
                        (refGroupParent && refGroupParent.id !== groupFacade.parentID)) {
                        refGroup.moveTo(groupFacade.parentID === "0" ? vault : vault.findGroupByID(groupFacade.parentID));
                    }
                }

                consumeGroupFacade(vault.findGroupByID(groupFacade.id), groupFacade);
                return false; // Group processed, remove from the list
            });

            if (originalLength === groupsLeft.length) {
                const ids = groupsLeft.map(group => group.id).join(", ");
                throw new Error(`Processing facade stalled: groups not resolvable: ${ids}`);
            }
        }
    }

    function handleEntryRemoval() {
        if (!mergeMode) {
            currentEntries.forEach((currentEntryFacade) => {
                if (!entries.some(entry => entry.id === currentEntryFacade.id)) {
                    const targetEntry = vault.findEntryByID(currentEntryFacade.id);
                    if (targetEntry) targetEntry.delete();
                }
            });
        }
    }

    function processEntries() {
        let entriesLeft = [...entries];
        entriesLeft = entriesLeft.filter((entryRaw) => {
            const entryFacade = { ...entryRaw };
            const entryIDTargetedNew = idSignifiesNew(entryFacade.id, mergeMode);

            if (!entryFacade.id || entryIDTargetedNew) {
                let targetGroupID = entryFacade.parentID;
                if (idSignifiesNew(targetGroupID, mergeMode)) {
                    targetGroupID = newIDLookup[targetGroupID] || targetGroupID;
                }

                const targetGroup = vault.findGroupByID(targetGroupID);
                if (targetGroup) {
                    const newEntry = targetGroup.createEntry();
                    if (entryIDTargetedNew) {
                        newIDLookup[entryFacade.id] = newEntry.id;
                    }
                    entryFacade.id = newEntry.id;
                    if (entryFacade.type) {
                        newEntry.setAttribute(FacadeType, entryFacade.type);
                    }
                } else {
                    return true; // Group not ready, stall this entry
                }
            } else {
                const refEntry = vault.findEntryByID(entryFacade.id);
                const refGroup = refEntry.getGroup();
                if (refGroup.id !== entryFacade.parentID) {
                    refEntry.moveToGroup(vault.findGroupByID(entryFacade.parentID));
                }
            }

            const entryToUpdate = vault.findEntryByID(entryFacade.id);
            consumeEntryFacade(entryToUpdate, entryFacade);
            return false; // Entry processed, remove from the list
        });
    }

    function handleAttributes() {
        Object.keys(currentAttributes)
            .filter(attr => !attributes.hasOwnProperty(attr))
            .forEach(attr => vault.deleteAttribute(attr));

        Object.keys(attributes).forEach(attr => {
            if (attr !== Vault.Attribute.AttachmentsKey || !mergeMode) {
                if (!currentAttributes[attr] || currentAttributes[attr] !== attributes[attr]) {
                    vault.setAttribute(attr, attributes[attr]);
                }
            }
        });
    }

    handleGroupRemoval();
    currentGroups = getGroupsFacades(vault); // Update facade properties after groups deletion
    processGroups();
    handleEntryRemoval();
    currentEntries = getEntriesFacades(vault); // Update facade properties after entries deletion
    processEntries();
    handleAttributes();
}

/**
 * Create a vault facade from an Vault instance
 * @param vault A vault instance
 * @returns A vault facade
 * @memberof module:Buttercup
 */
export function createVaultFacade(
    vault: Vault,
    options: CreateVaultFacadeOptions = {}
): VaultFacade {
    const { includeTrash = true } = options;
    return {
        _tag: generateUUID(),
        _ver: FACADE_VERSION,
        type: "vault",
        id: vault.id,
        attributes: vault.getAttribute() as { [key: string]: string },
        groups: getGroupsFacades(vault, { includeTrash }),
        entries: getEntriesFacades(vault, { includeTrash })
    };
}

/**
 * Create a group facade from a Group instance
 * @param group The group instance
 * @param parentID The parent ID of the group
 * @memberof module:Buttercup
 */
export function createGroupFacade(group: Group | null, parentID: GroupID = "0"): GroupFacade {
    return {
        type: "group",
        id: group ? group.id : null,
        title: group ? group.getTitle() : "",
        attributes: group ? (group.getAttribute() as { [key: string]: string }) : {},
        parentID
    };
}

/**
 * Get all entry facades for a vault
 * @param vault A vault instance
 * @param options Options for getting entry facades
 * @returns An array of entry facades
 */
function getEntriesFacades(vault: Vault, options: GetGroupEntriesFacadesOptions = {}) {
    return vault
        .getGroups()
        .reduce((output, group) => [...output, ...getGroupEntriesFacades(group, options)], []);
}

/**
 * Convert a group of entries into an array of facades
 * @param entryCollection A group instance
 * @param options Options for getting entry facades
 * @returns An array of entry facades
 */
function getGroupEntriesFacades(
    entryCollection: Group,
    options: GetGroupEntriesFacadesOptions = {}
): Array<EntryFacade> {
    const { includeTrash = true } = options;
    const facades = entryCollection.getEntries().reduce((facades, entry) => {
        if (includeTrash === false && entry.isInTrash()) {
            return facades;
        }
        return [...facades, Object.assign({}, createEntryFacade(entry))];
    }, []);
    entryCollection.getGroups().forEach((group) => {
        facades.push(...getGroupEntriesFacades(group, options));
    });
    return facades;
}

/**
 * Convert an array of groups into an array of facades
 * @param vault The vault instance
 * @param options Options for getting group facades
 * @returns An array of group facades
 */
function getGroupsFacades(vault: Vault, options: GetGroupsFacadesOptions = {}): Array<GroupFacade> {
    const { includeTrash = true } = options;
    return vault._groups.reduce((output, group) => {
        if (includeTrash === false && (group.isTrash() || group.isInTrash())) {
            return output;
        }
        return [
            ...output,
            createGroupFacade(group, group.vault.format.getItemParentID(group._source))
        ];
    }, []);
}
