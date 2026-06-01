const { userUpdateSchema } = require('../routes/_schemas');

const testPayload = {
  fullName: "Olimtoy",
  role: "user",
  isActive: true,
  permissions: {
    clients: { read: true, create: false, update: false, delete: false }
  }
};

const parsed = userUpdateSchema.safeParse(testPayload);
console.log('SafeParse Success:', parsed.success);
if (parsed.success) {
  console.log('Parsed data:', parsed.data);
} else {
  console.error('Parse errors:', parsed.error);
}
