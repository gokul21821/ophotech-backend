import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const BUCKET_NAME = process.env.STORAGE_BUCKET || 'resources-images';

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function uploadFile(
  filePath: string,
  fileData: Buffer,
  contentType?: string
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, fileData, {
      cacheControl: '3600',
      upsert: false,
      contentType,
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  return data.path;
}

export async function deleteFile(filePath: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET_NAME).remove([filePath]);

  if (error) {
    throw new Error(`Delete failed: ${error.message}`);
  }
}

export function getPublicUrl(filePath: string): string | null {
  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
  return data.publicUrl ?? null;
}

