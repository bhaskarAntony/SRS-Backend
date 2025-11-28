const XLSX = require('xlsx');
const User = require('../models/User');
const emailService = require('./emailService');
const crypto = require('crypto');


exports.parseUsersExcel = (buffer) => {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);

  return data.map(row => ({
    firstName: row['First Name'] || row.firstName,
    lastName: row['Last Name'] || row.lastName,
    email: row['Email'] || row.email,
    phone: row['Phone'] || row.phone,
    password: row['Password'] || 'temp123'
  }));
};


exports.importUsers = async (users) => {
  const results = {
    success: 0,
    failed: 0,
    errors: []
  };

  for (const userData of users) {
    try {
      await User.create({
        ...userData,
        role: 'user'
      });
      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push({
        email: userData.email,
        error: error.message
      });
    }
  }

  return results;
};


exports.exportUsers = async (users) => {
  const data = users.map(user => ({
    'First Name': user.firstName,
    'Last Name': user.lastName,
    'Email': user.email,
    'Phone': user.phone,
    'Created At': user.createdAt.toISOString().split('T')[0]
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};


exports.parseMembersExcel = (buffer) => {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);

  return data.map(row => ({
    firstName: row['First Name'] || row.firstName,
    lastName: row['Last Name'] || row.lastName,
    email: row['Email'] || row.email,
    phone: row['Phone'] || row.phone,
    membershipTier: row['Membership Tier'] || row.membershipTier || 'Gold',
    sponsoredBy: row['Sponsored By'] || row.sponsoredBy
  }));
};


exports.importMembers = async (members) => {
  const results = {
    success: 0,
    failed: 0,
    errors: []
  };

  for (const memberData of members) {
    try {
      
      const tempPassword = crypto.randomBytes(8).toString('hex');
      
      const member = await User.create({
        ...memberData,
        role: 'member',
        password: tempPassword,
        membershipDate: new Date()
      });

      
      await emailService.sendMemberCredentials(member.email, {
        firstName: member.firstName,
        email: member.email,
        password: tempPassword,
        loginUrl: `${process.env.FRONTEND_URL}/login`
      });

      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push({
        email: memberData.email,
        error: error.message
      });
    }
  }

  return results;
};


exports.exportMembers = async (members) => {
  const data = members.map(member => ({
    'First Name': member.firstName,
    'Last Name': member.lastName,
    'Email': member.email,
    'Phone': member.phone,
    'Membership Tier': member.membershipTier,
    'Membership Date': member.membershipDate ? member.membershipDate.toISOString().split('T')[0] : '',
    'Loyalty Points': member.loyaltyPoints,
    'Sponsored By': member.sponsoredBy ? `${member.sponsoredBy.firstName} ${member.sponsoredBy.lastName}` : '',
    'Created At': member.createdAt.toISOString().split('T')[0]
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Members');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};


exports.getMemberTemplate = async () => {
  const templateData = [
    {
      'First Name': 'John',
      'Last Name': 'Doe',
      'Email': 'john.doe@example.com',
      'Phone': '+919876543210',
      'Membership Tier': 'Gold',
      'Sponsored By': 'sponsor@example.com'
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Member Template');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};