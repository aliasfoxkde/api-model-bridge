import { readFileSync, realpathSync } from 'node:fs';
import { join, sep } from 'node:path';

export interface DashboardAsset {
  content: string;
  contentType: string;
}

// Dashboard assets are flat files, so a legitimate name never contains a
// separator, a NUL byte, or a dot segment. Rejecting those lexically keeps
// platform-specific separators and encoded paths from reaching the
// filesystem at all.
function isSafeAssetName(file: string): boolean {
  return file.length > 0 && file !== '.' && file !== '..' && !/[/\\\0]/.test(file);
}

function contentTypeFor(file: string): string {
  const ext = file.split('.').pop();
  return ext === 'js' ? 'application/javascript'
    : ext === 'css' ? 'text/css'
      : 'text/plain';
}

/**
 * Read a dashboard asset by name, refusing anything that would read outside
 * `root` — including a symlink inside the root whose target escapes it.
 * Both the root and the target are canonicalized with realpathSync before
 * the containment comparison. Returns null when the name is unsafe or the
 * asset does not exist; callers map null to a bare 404.
 */
export function readDashboardAsset(root: string, file: string): DashboardAsset | null {
  if (!isSafeAssetName(file)) {
    return null;
  }
  let canonicalRoot: string;
  let target: string;
  try {
    canonicalRoot = realpathSync(root);
    target = realpathSync(join(canonicalRoot, file));
  } catch {
    // Root not built yet, or asset does not exist.
    return null;
  }
  if (target !== canonicalRoot && !target.startsWith(canonicalRoot + sep)) {
    return null;
  }
  try {
    return { content: readFileSync(target, 'utf-8'), contentType: contentTypeFor(file) };
  } catch {
    return null;
  }
}
