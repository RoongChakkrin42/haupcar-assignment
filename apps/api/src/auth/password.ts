import bcrypt from 'bcryptjs';

const COST = 10;
// Compared against when the email is unknown, so both paths take the same time.
const DUMMY_HASH = bcrypt.hashSync('dummy-password', COST);

export const hashPassword = (plain: string) => bcrypt.hash(plain, COST);

export const verifyPassword = (plain: string, hash: string | undefined) =>
  bcrypt.compare(plain, hash ?? DUMMY_HASH).then((ok) => ok && hash !== undefined);
