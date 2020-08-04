import TextDatasource from "./TextDatasource";
import { fireInstantiationHandlers, registerDatasource } from "./register";
import Credentials from "../credentials/Credentials";
import { getCredentials } from "../credentials/channel";
import { ATTACHMENT_EXT, decryptAttachment, encryptAttachment } from "../tools/attachments";
import { AttachmentDetails, BufferLike, DatasourceLoadedData, EncryptedContent, History, MemoryStore, VaultID } from "../types";

const TYPE = "memory";

/**
 * Memory datasource for temporary storage
 * @augments TextDatasource
 * @memberof module:Buttercup
 */
export default class MemoryDatasource extends TextDatasource {
    _property: string;
    _store: MemoryStore;

    /**
     * Constructor for the datasource
     * @param credentials The credentials instance with which to
     *  use to configure the datasource
     */
    constructor(credentials: Credentials) {
        super(credentials);
        const { data: credentialData } = getCredentials(credentials.id);
        const { datasource: datasourceConfig } = credentialData;
        const { property } = datasourceConfig;
        this._property = property;
        this._store = global[property] = global[property] || {};
        this.type = TYPE;
        fireInstantiationHandlers(TYPE, this);
    }

    /**
     * Ensure attachment paths exist
     * @memberof MemoryDatasource
     * @protected
     */
    async _ensureAttachmentsPaths(vaultID: VaultID): Promise<void> {
        this._store.attachments = this._store.attachments || {};
        this._store.attachments[vaultID] = this._store.attachments[vaultID] || {};
    }

    /**
     * Get attachment buffer
     * - Loads the attachment contents into a buffer
     * @param vaultID The ID of the vault
     * @param attachmentID The ID of the attachment
     * @memberof MemoryDatasource
     */
    getAttachment(vaultID: VaultID, attachmentID: string): Promise<BufferLike> {
        return this._ensureAttachmentsPaths(vaultID).then(() => {
            if (!this._store.attachments[vaultID][attachmentID]) {
                throw new Error(`No attachment found for ID: ${attachmentID}`);
            }
            return this._store.attachments[vaultID][attachmentID];
        });
    }

    // /**
    //  * Get attachment details
    //  * @param vaultID The ID of the vault
    //  * @param attachmentID The ID of the attachment
    //  * @returns The attachment details
    //  * @memberof MemoryDatasource
    //  */
    // getAttachmentDetails(vaultID: VaultID, attachmentID: string): Promise<AttachmentDetails> {
    //     const attachment = this._store.attachments[vaultID][attachmentID];
    //     const filename = `${attachmentID}.${ATTACHMENT_EXT}`;
    //     const filePath = `${this._property}/${filename}`;
    //     return Promise.resolve({
    //         id: attachmentID,
    //         vaultID,
    //         name: filename,
    //         filename: filePath,
    //         size: typeof attachment.byteLength === "number" ? attachment.byteLength : attachment.length,
    //         mime: null
    //     });
    // }

    /**
     * Load from a global property
     * @param credentials The credentials for decryption
     * @returns A promise resolving with vault history
     * @memberof MemoryDatasource
     */
    async load(credentials: Credentials): Promise<DatasourceLoadedData> {
        if (!this._store.vault) {
            throw new Error("No vault in memory");
        }
        this.setContent(this._store.vault);
        return super.load(credentials);
    }

    /**
     * Put encrypted attachment data
     * @param vaultID The ID of the vault
     * @param attachmentID The ID of the attachment
     * @param buffer The attachment data
     * @param details Attachment details
     * @memberof MemoryDatasource
     */
    putAttachment(vaultID: VaultID, attachmentID: string, buffer: BufferLike, details: AttachmentDetails): Promise<void> {
        return this._ensureAttachmentsPaths(vaultID).then(() => {
            this._store.attachments[vaultID][attachmentID] = buffer;
        });
    }

    /**
     * Remove an attachment
     * @param vaultID The ID of the vault
     * @param attachmentID The ID of the attachment
     * @memberof MemoryDatasource
     */
    removeAttachment(vaultID: VaultID, attachmentID: string): Promise<void> {
        return this._ensureAttachmentsPaths(vaultID).then(() => {
            this._store.attachments[vaultID][attachmentID] = null;
            delete this._store.attachments[vaultID][attachmentID];
        });
    }

    /**
     * Save vault history memory
     * @param history The vault history to save
     * @param credentials The credentials to save with
     * @returns A promise that resolves when saving is complete
     * @memberof MemoryDatasource
     */
    save(history: History, credentials: Credentials): Promise<EncryptedContent> {
        return super.save(history, credentials).then(encrypted => {
            this._store.vault = encrypted;
            return encrypted;
        });
    }

    /**
     * Whether or not the datasource supports attachments
     * @memberof MemoryDatasource
     */
    supportsAttachments(): boolean {
        return true;
    }
}

registerDatasource(TYPE, MemoryDatasource);
