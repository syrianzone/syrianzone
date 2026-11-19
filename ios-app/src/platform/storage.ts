import { personalStorage } from './persistence';
import { createDocumentStore } from './document-store';

const documents = createDocumentStore(personalStorage);
export const readDocument = documents.read;
export const writeDocument = documents.write;
