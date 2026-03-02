import { auth, pool } from "./auth-instance.mjs";

function getArg(name) {
  const entry = process.argv.find((value) => value.startsWith(`${name}=`));
  return entry ? entry.slice(name.length + 1) : undefined;
}

const email = getArg("--email");
const password = getArg("--password");
const name = getArg("--name") ?? (email ? email.split("@")[0] : undefined);

if (!email || !password) {
  throw new Error(
    'Usage: npm run admin:create -- --email=kontur-znaniy@xn----8sbuffbvcbexxn.xn--p1ai --password=CHANGE_ME --name="Kontur Admin"'
  );
}

try {
  const ctx = await auth.$context;
  const normalizedEmail = email.toLowerCase();
  const existing = await ctx.internalAdapter.findUserByEmail(normalizedEmail, {
    includeAccounts: true,
  });
  const hashedPassword = await ctx.password.hash(password);

  if (!existing) {
    const user = await ctx.internalAdapter.createUser({
      email: normalizedEmail,
      name: name ?? "Nook Admin",
      emailVerified: true,
      role: "admin",
    });

    await ctx.internalAdapter.linkAccount({
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: hashedPassword,
    });

    console.log(`Admin created: ${normalizedEmail}`);
  } else {
    await ctx.internalAdapter.updateUser(existing.user.id, {
      name: name ?? existing.user.name,
      emailVerified: true,
      role: "admin",
    });

    const accounts = await ctx.internalAdapter.findAccounts(existing.user.id);
    const credentialAccount = accounts.find(
      (account) => account.providerId === "credential"
    );

    if (credentialAccount) {
      await ctx.internalAdapter.updatePassword(existing.user.id, hashedPassword);
    } else {
      await ctx.internalAdapter.createAccount({
        userId: existing.user.id,
        providerId: "credential",
        accountId: existing.user.id,
        password: hashedPassword,
      });
    }

    console.log(`Admin updated: ${normalizedEmail}`);
  }
} finally {
  await pool.end();
}
