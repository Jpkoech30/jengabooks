import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class FileStorageService implements OnModuleDestroy {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly baseUploadDir: string;

  constructor() {
    // Base upload directory relative to project root
    this.baseUploadDir = path.resolve(process.cwd(), 'uploads', 'statements');
    this.ensureDir(this.baseUploadDir);
    this.logger.log(`File storage base directory: ${this.baseUploadDir}`);
  }

  /**
   * Save an uploaded file to the structured directory.
   *
   * Path: /uploads/statements/{tenantId}/{institution}/{year}/{month}/{originalName}_{timestamp}.{ext}
   */
  async saveFile(
    tenantId: string,
    institution: string,
    file: Express.Multer.File,
  ): Promise<{ filePath: string; fileSize: number }> {
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const timestamp = Date.now().toString();
    const ext = path.extname(file.originalname) || '.bin';
    const baseName = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 50);
    const fileName = `${baseName}_${timestamp}${ext}`;

    const dirPath = path.join(this.baseUploadDir, tenantId, institution, year, month);
    this.ensureDir(dirPath);

    const filePath = path.join(dirPath, fileName);

    // Write file to disk
    await fs.promises.writeFile(filePath, file.buffer);

    this.logger.log(`File saved: ${filePath} (${file.size} bytes)`);

    return {
      filePath,
      fileSize: file.size,
    };
  }

  /**
   * Delete a file from disk.
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.promises.unlink(filePath);
      this.logger.log(`File deleted: ${filePath}`);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        this.logger.error(`Failed to delete file ${filePath}: ${error.message}`);
      }
    }
  }

  /**
   * Read a file from disk.
   */
  async readFile(filePath: string): Promise<Buffer> {
    return fs.promises.readFile(filePath);
  }

  /**
   * Clean up files older than 90 days.
   * Called by a cron job.
   */
  async cleanupOldFiles(): Promise<number> {
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000; // 90 days
    let deletedCount = 0;

    const deleteOldFiles = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await deleteOldFiles(fullPath);
            // Remove empty directories
            const remaining = await fs.promises.readdir(fullPath);
            if (remaining.length === 0) {
              await fs.promises.rmdir(fullPath);
            }
          } else if (entry.isFile()) {
            const stat = await fs.promises.stat(fullPath);
            if (stat.mtimeMs < cutoff) {
              await fs.promises.unlink(fullPath);
              deletedCount++;
            }
          }
        }
      } catch {
        // Ignore errors during cleanup
      }
    };

    await deleteOldFiles(this.baseUploadDir);
    this.logger.log(`Cleanup: deleted ${deletedCount} old files`);
    return deletedCount;
  }

  /**
   * Ensure a directory exists, creating it recursively if needed.
   */
  private ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Cleanup on module destroy.
   */
  async onModuleDestroy(): Promise<void> {
    // No cleanup needed; files persist on disk
  }
}
