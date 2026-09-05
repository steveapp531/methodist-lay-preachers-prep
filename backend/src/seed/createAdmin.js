import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { logger } from '../config/logger.js';
import { Exam } from '../models/Exam.js';
import { User } from '../models/User.js';

/**
 * Creates or promotes an administrator.
 *
 * Reads from the command line rather than from environment variables so a real
 * password never ends up in a shell history file or a committed .env.
 *   npm run create:admin
 *   npm run create:admin -- --email you@example.com
 */
async function main() {
  await connectDatabase();

  const args = Object.fromEntries(
    process.argv
      .slice(2)
      .filter((a) => a.startsWith('--'))
      .map((a) => {
        const [key, ...rest] = a.replace(/^--/, '').split('=');
        return [key, rest.join('=') || true];
      }),
  );

  const rl = readline.createInterface({ input: stdin, output: stdout });

  try {
    const name = args.name || (await rl.question('Full name: '));
    const email = String(args.email || (await rl.question('Email address: '))).trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      logger.error('That does not look like a valid email address.');
      process.exitCode = 1;
      return;
    }

    const existing = await User.findOne({ email });
    if (existing) {
      const confirm = await rl.question(`${email} already exists. Promote to administrator and reset the password? (y/N) `);
      if (confirm.trim().toLowerCase() !== 'y') {
        logger.info('No changes made.');
        return;
      }
    }

    const password = args.password || (await rl.question('Password (at least 8 characters, one letter and one number): '));
    if (String(password).length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      logger.error('That password is too weak. Use at least 8 characters with a letter and a number.');
      process.exitCode = 1;
      return;
    }

    const part2 = await Exam.findOne({ code: 'PART2' });
    const user = existing || new User({ name, email, examStage: part2?._id || null, onboardedAt: new Date() });
    user.name = name || user.name;
    user.role = 'admin';
    user.isActive = true;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.setPassword(String(password));
    await user.save();

    logger.info(`${existing ? 'Promoted' : 'Created'} administrator: ${email}`);
  } finally {
    rl.close();
    await disconnectDatabase();
  }
}

main().catch(async (err) => {
  logger.error('Could not create the administrator', err);
  await disconnectDatabase().catch(() => {});
  process.exit(1);
});
