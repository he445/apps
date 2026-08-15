import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = 'Administrador Ojanuan';

  if (!adminEmail || !adminPassword) {
    throw new Error('ADMIN_EMAIL e ADMIN_PASSWORD são obrigatórios para provisionar um administrador.');
  }
  if (adminPassword.length < 12) {
    throw new Error('ADMIN_PASSWORD deve ter ao menos 12 caracteres.');
  }

  console.log(`🌱 Verificando/Criando usuário Administrador (${adminEmail})...`);

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail.toLowerCase() },
  });

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  if (existingAdmin) {
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: {
        role: Role.ADMIN,
        password: passwordHash,
        isDeleted: false,
      },
    });
    console.log('✅ Usuário existente atualizado para ADMIN com a nova senha definida.');
  } else {
    await prisma.user.create({
      data: {
        fullName: adminName,
        email: adminEmail.toLowerCase(),
        password: passwordHash,
        role: Role.ADMIN,
      },
    });
    console.log('✅ Novo usuário Administrador criado com sucesso.');
  }

  console.log(`Administrador provisionado: ${adminEmail}`);
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
