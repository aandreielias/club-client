import { settings } from '../../settings';
import { api, permissions, session } from '../../lib/container';
import { FileDownloads } from './FileDownloads';
import { FileLinks } from './FileLinks';
import { FilePolicy } from './FilePolicy';
import { FilesApi } from './FilesApi';
import { FileTypes } from './FileTypes';

/** File services, created once and shared by the file pages. */
export const filesApi = new FilesApi(api);
export const fileTypes = new FileTypes(settings.files.imageExtensions, settings.files.documentExtensions);
export const fileLinks = new FileLinks(filesApi, settings.files.linkReuseMarginMs);
export const filePolicy = new FilePolicy(session, permissions, fileTypes);
export const fileDownloads = new FileDownloads(fileLinks);
