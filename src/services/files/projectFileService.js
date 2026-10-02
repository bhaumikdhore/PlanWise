import { supabase } from '../../lib/supabaseClient.js';
import { recordActivity } from '../activity/activityLogService.js';

const STORAGE_BUCKET = 'project-files';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireClient() {
  if (!supabase) throw new Error('Configure VITE_SUPABASE_URL and a Supabase anon or publishable key first.');
}

function safeStorageName(name) {
  return name.normalize('NFKC').replace(/[\\/]/g, '_').replace(/[^\w.() -]/g, '_').trim() || 'upload';
}

function mapFile(row) {
  const extension = row.name.includes('.') ? row.name.split('.').pop() : '';
  const bytes = Number(row.size_bytes) || 0;
  const size = bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return {
    id: row.id,
    projectId: row.project_id || '',
    uploadedBy: row.uploaded_by,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    name: row.name,
    mimeType: row.mime_type || '',
    sizeBytes: bytes,
    size,
    kind: (extension || row.mime_type?.split('/').pop() || 'FILE').slice(0, 4).toUpperCase(),
    addedAt: row.created_at
  };
}

export async function getProjectFiles(projectId) {
  requireClient();
  const { data, error } = await supabase.from('files')
    .select('id,project_id,uploaded_by,storage_bucket,storage_path,name,mime_type,size_bytes,created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(mapFile);
}

export async function uploadProjectFile(file, projectId, userId) {
  requireClient();
  if (!file?.name || !uuidPattern.test(userId)) throw new Error('A valid file and signed-in user are required.');
  if (projectId && !uuidPattern.test(projectId)) throw new Error('The project ID is invalid. Refresh the project and try again.');

  const storagePath = projectId
    ? `${projectId}/${userId}/${crypto.randomUUID()}-${safeStorageName(file.name)}`
    : `${userId}/${crypto.randomUUID()}-${safeStorageName(file.name)}`;
  const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'application/octet-stream'
  });
  if (uploadError) throw uploadError;

  const metadata = {
    project_id: projectId || null,
    uploaded_by: userId,
    storage_bucket: STORAGE_BUCKET,
    storage_path: storagePath,
    name: file.name,
    mime_type: file.type || null,
    size_bytes: file.size
  };
  const { data, error: metadataError } = await supabase.from('files')
    .insert(metadata)
    .select('id,project_id,uploaded_by,storage_bucket,storage_path,name,mime_type,size_bytes,created_at')
    .single();
  if (metadataError) {
    const { error: cleanupError } = await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
    if (cleanupError) throw new Error(`${metadataError.message} Storage cleanup also failed: ${cleanupError.message}`);
    throw metadataError;
  }
  await recordActivity({ actorId: userId, projectId, action: 'file_uploaded', entityType: 'file', entityId: data.id, metadata: { name: data.name, size_bytes: data.size_bytes } });
  return mapFile(data);
}

export async function downloadProjectFile(file) {
  requireClient();
  const { data, error } = await supabase.storage.from(file.storageBucket || STORAGE_BUCKET).download(file.storagePath);
  if (error) throw error;
  return data;
}

export async function deleteProjectFile(file, userId) {
  requireClient();
  const bucket = file.storageBucket || STORAGE_BUCKET;
  const { error: storageError } = await supabase.storage.from(bucket).remove([file.storagePath]);
  if (storageError) throw storageError;

  const { error: metadataError } = await supabase.from('files').delete().eq('id', file.id);
  if (metadataError) throw metadataError;
  await recordActivity({ actorId: userId, projectId: file.projectId || null, action: 'file_deleted', entityType: 'file', entityId: file.id, metadata: { name: file.name } });
}