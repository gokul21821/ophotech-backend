import { supabase, BUCKET_NAME } from '../services/supabaseClient';
import { collectImageFilePaths } from './tiptap';

export type ContentType = 'newsletter' | 'blog' | 'caseStudy';

const folderMap: Record<ContentType, string> = {
  newsletter: 'newsletters',
  blog: 'blogs',
  caseStudy: 'case-studies',
};

function getFolderPrefix(type: ContentType, id: string): string {
  return `${folderMap[type]}/${id}`;
}

async function listAllFilesInFolder(folderPrefix: string): Promise<string[]> {
  const paths: string[] = [];
  const limit = 1000;
  let offset = 0;

  // Supabase storage list is paginated; iterate until fewer than `limit` returned.
  // Note: list() returns objects with `name` (and optional metadata).
  while (true) {
    const { data, error } = await supabase.storage.from(BUCKET_NAME).list(folderPrefix, {
      limit,
      offset,
    });

    if (error) {
      throw new Error(`Storage list failed: ${error.message}`);
    }

    const files = data ?? [];
    for (const f of files) {
      if (f?.name) paths.push(`${folderPrefix}/${f.name}`);
    }

    if (files.length < limit) break;
    offset += limit;
  }

  return paths;
}

async function removeFiles(paths: string[]): Promise<void> {
  const chunkSize = 1000;
  for (let i = 0; i < paths.length; i += chunkSize) {
    const chunk = paths.slice(i, i + chunkSize);
    const { error } = await supabase.storage.from(BUCKET_NAME).remove(chunk);
    if (error) {
      throw new Error(`Storage delete failed: ${error.message}`);
    }
  }
}

/**
 * Deletes any objects under `<type>/<id>/` that are NOT referenced by the TipTap JSON.
 *
 * Requires TipTap image nodes to include `attrs.filePath` (authoritative).
 */
export async function syncStorageWithContent(
  type: ContentType,
  id: string,
  contentJson: unknown
): Promise<{ deleted: number }> {
  const folderPrefix = getFolderPrefix(type, id);

  const referenced = collectImageFilePaths(contentJson);
  const allFiles = await listAllFilesInFolder(folderPrefix);

  // Only delete files inside the folder that are not referenced.
  const toDelete = allFiles.filter((p) => !referenced.has(p));

  if (toDelete.length > 0) {
    await removeFiles(toDelete);
  }

  return { deleted: toDelete.length };
}

/**
 * Deletes all objects under `<type>/<id>/` (used when deleting the record).
 */
export async function deleteAllContentImages(type: ContentType, id: string): Promise<number> {
  const folderPrefix = getFolderPrefix(type, id);
  const allFiles = await listAllFilesInFolder(folderPrefix);
  if (allFiles.length > 0) {
    await removeFiles(allFiles);
  }
  return allFiles.length;
}

