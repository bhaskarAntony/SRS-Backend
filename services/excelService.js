const XLSX = require('xlsx');
const User = require('../models/User');
const emailService = require('./emailService');
const crypto = require('crypto');


exports.parseMembersExcel = (buffer) => {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const data = XLSX.utils.sheet_to_json(worksheet);

  return data.map(row => ({
    firstName: row['First Name'] || row['firstName'] || row['FIRSTNAME'] || '',
    memberId: row['Member ID'] || row['memberId'] || row['MEMBERID'] || '',
  }));
};


// 2) IMPORT MULTIPLE MEMBERS
exports.importMembers = async (membersList) => {
  const results = [];

  for (const row of membersList) {
    const firstName = String(row.firstName || '').trim();
    const memberId = String(row.memberId || '').trim().toUpperCase();

    if (!firstName || !memberId) {
      results.push({
        memberId,
        firstName,
        status: 'failed',
        reason: 'Missing firstName or memberId'
      });
      continue;
    }

    // Check Duplicate
    const exists = await User.findOne({ memberId, role: 'member' });

    if (exists) {
      results.push({
        memberId,
        firstName,
        status: 'failed',
        reason: 'Member ID already exists'
      });
      continue;
    }

    // Auto-generate credentials
 const password = `${firstName.toLowerCase()}@${memberId.toLowerCase()}`;
const fakeEmail = `${firstName.toLowerCase()}.${memberId.toLowerCase()}@membersrs.com`;
const phone = `+91${memberId.replace(/[^0-9]/g, '')}`;

    // Create User
    const newMember = await User.create({
      firstName,
      lastName: '',
      email: fakeEmail,
      phone,
      password,
      role: 'member',
      memberId,
      isActive: true
    });

    newMember.password = undefined;

    results.push({
      status: 'success',
      memberId,
      firstName,
      loginInfo: {
        email: fakeEmail,
        password,
      }
    });
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