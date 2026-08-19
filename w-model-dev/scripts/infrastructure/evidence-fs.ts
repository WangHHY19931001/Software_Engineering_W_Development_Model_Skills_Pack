/**
 * Filesystem adapter for runtime evidence export.
 *
 * Keeps filesystem access at the infrastructure layer while evidence export
 * logic owns allowlisting, sanitization, manifest generation, and verification.
 */
import { promises as fs } from 'node:fs';

export { fs as evidenceFs };
