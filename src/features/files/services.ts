import { settings } from '../../settings';
import { api, bus, directory, permissions, session } from '../../lib/container';
import { FileDownloads } from './FileDownloads';
import { FileLinks } from './FileLinks';
import { FilePolicy } from './FilePolicy';
import { FilesApi } from './FilesApi';
import { FilePreviews } from './FilePreviews';
import { FileMover } from './FileMover';
import { FolderZip } from './FolderZip';
import { TagCandidates } from './TagCandidates';
import { OfficeReader } from './OfficeReader';
import { FileTypes } from './FileTypes';

/** File services, created once and shared by the file pages. */
export const filesApi = new FilesApi(api);
export const fileTypes = new FileTypes(settings.files.imageExtensions, settings.files.documentExtensions);
export const fileLinks = new FileLinks(filesApi, settings.files.linkReuseMarginMs);
export const filePolicy = new FilePolicy(session, permissions, fileTypes);
export const fileDownloads = new FileDownloads(fileLinks);
export const filePreviews = new FilePreviews(fileLinks, new OfficeReader(settings.files.preview));
export const fileMover = new FileMover(filesApi, fileTypes, bus);
export const folderZip = new FolderZip(filesApi, fileLinks, settings.files.zipMaxBytes);
export const tagCandidates = new TagCandidates(directory, permissions, session);
/** A member dropped onto a gallery tile, by file id: the photo window opens its tag editor with them (PhotoView). */
export const photoTagDrops = new Map<string, string>();
