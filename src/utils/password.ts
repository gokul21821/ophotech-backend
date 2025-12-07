import bcryptjs from 'bcryptjs';

// Hash a password
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcryptjs.genSalt(10); // Generate salt with 10 rounds
  const hashedPassword = await bcryptjs.hash(password, salt);
  return hashedPassword;
}

// Compare plain password with hashed password
export async function comparePassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  return await bcryptjs.compare(plainPassword, hashedPassword);
}