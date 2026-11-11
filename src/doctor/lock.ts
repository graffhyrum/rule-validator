// Doctor-specific lock: `.doctor/lock` via O_EXCL. One holder at a time;
// stale locks (mtime older than STALE_MS) are reclaimed at most once per call.
import { promises as fs } from "node:fs";
import path from "node:path";

const STALE_MS = 10 * 60 * 1000;

export interface LockResult {
	ok: boolean;
	holder?: string;
}

export async function acquireLock(doctorDir: string): Promise<LockResult> {
	const lockPath = path.join(doctorDir, "lock");
	const first = await tryCreateLock(lockPath);
	if (first) return first;
	const stat = await fs.stat(lockPath).catch(() => null);
	if (!stat) return { ok: false, holder: "lock-unreadable" };
	if (Date.now() - stat.mtimeMs <= STALE_MS) {
		const holder = (await fs.readFile(lockPath, "utf8").catch(() => "unknown")).trim();
		return { ok: false, holder };
	}
	return reclaimStaleLock(lockPath);
}

export async function releaseLock(doctorDir: string): Promise<void> {
	try {
		await fs.unlink(path.join(doctorDir, "lock"));
	} catch {
		// Missing lock is fine — release is best-effort by design.
	}
}

async function tryCreateLock(lockPath: string): Promise<LockResult | null> {
	try {
		const handle = await fs.open(lockPath, "wx");
		await handle.writeFile(`pid=${process.pid} started=${new Date().toISOString()}\n`);
		await handle.close();
		return { ok: true };
	} catch (error) {
		return (error as NodeJS.ErrnoException).code === "EEXIST"
			? null
			: { ok: false, holder: `lock-error:${(error as Error).message}` };
	}
}

async function reclaimStaleLock(lockPath: string): Promise<LockResult> {
	try {
		await fs.unlink(lockPath);
	} catch {
		// Stale but unremovable (e.g. a directory): refuse rather than recurse.
		return { ok: false, holder: "stale-lock-unremovable" };
	}
	const retried = await tryCreateLock(lockPath);
	return retried ?? { ok: false, holder: "reclaim-race" };
}
