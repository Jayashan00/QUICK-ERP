import assert from 'node:assert/strict';
import { z } from 'zod';
import {
  formatUserFriendlyValidationError,
  formatFieldLabel,
  requiredString,
  optionalString,
  emailSchema,
  phoneSchema,
  nonNegativeNumber,
  optionalDate,
  optionalTodayOrFutureDate,
} from '../src/shared/validation';
import { customerSchema } from '../src/features/customers/schemas/customerSchema';
import { supplierSchema } from '../src/features/suppliers/schemas/supplier.schema';
import { productFormSchema } from '../src/features/products/schemas/productSchema';
import { salesOrderSchema } from '../src/features/sales/schemas/salesSchemas';
import { warehouseSchema } from '../src/features/inventory/schemas/inventorySchemas';
import { loginSchema, resetPasswordSchema } from '../src/features/auth/schemas/securitySchemas';

// 1. Test formatFieldLabel
assert.equal(formatFieldLabel('customerName'), 'Customer name');
assert.equal(formatFieldLabel('billing_address'), 'Billing address');
assert.equal(formatFieldLabel('sellingPrice'), 'Selling price');
assert.equal(formatFieldLabel(''), 'This field');

// 2. Test formatUserFriendlyValidationError
// 2.1 Required field
const req1 = formatUserFriendlyValidationError('Required.', 'Customer Name');
assert(req1.includes('Customer Name is required'), `Expected required message, got: ${req1}`);
assert(req1.includes('Please enter a valid'), `Expected guidance, got: ${req1}`);

const req2 = formatUserFriendlyValidationError('This field is required.');
assert(req2.includes('This field is required'), `Expected message, got: ${req2}`);
assert(req2.includes('Please enter a valid value to continue'), `Expected guidance, got: ${req2}`);

// 2.2 Email validation
const emailErr = formatUserFriendlyValidationError('Enter a valid email address.', 'Email');
assert(emailErr.includes('Please enter a valid email address'), `Expected email guide, got: ${emailErr}`);
assert(emailErr.includes('name@company.com'), `Expected email example, got: ${emailErr}`);

// 2.3 Phone validation
const phoneErr1 = formatUserFriendlyValidationError('Phone number contains invalid characters.', 'Phone');
assert(phoneErr1.includes('Phone number contains invalid characters'), `Expected phone guide, got: ${phoneErr1}`);
assert(phoneErr1.includes('numbers, spaces, hyphens'), `Expected allowed chars, got: ${phoneErr1}`);

const phoneErr2 = formatUserFriendlyValidationError('Enter a valid phone number (7-15 digits).', 'Phone');
assert(phoneErr2.includes('7 to 15 digits'), `Expected digit count guide, got: ${phoneErr2}`);

// 2.4 Number & Negative validation
const numErr1 = formatUserFriendlyValidationError('Expected number, received nan', 'Cost Price');
assert(numErr1.includes('Cost Price must be a valid number'), `Expected number explanation, got: ${numErr1}`);
assert(numErr1.includes('Please enter numeric digits only'), `Expected numeric guidance, got: ${numErr1}`);

const numErr2 = formatUserFriendlyValidationError('Cost price cannot be negative.', 'Cost Price');
assert(numErr2.includes('cannot be negative'), `Expected negative explanation, got: ${numErr2}`);
assert(numErr2.includes('0.00 or higher'), `Expected non-negative guidance, got: ${numErr2}`);

// 2.5 Positive amount
const posErr = formatUserFriendlyValidationError('Quantity must be greater than zero.', 'Quantity');
assert(posErr.includes('must be greater than zero'), `Expected positive explanation, got: ${posErr}`);
assert(posErr.includes('positive amount'), `Expected positive guidance, got: ${posErr}`);

// 2.6 Length constraints
const maxErr = formatUserFriendlyValidationError('Name cannot exceed 100 characters.', 'Name');
assert(maxErr.includes('cannot exceed 100 characters'), `Expected max explanation, got: ${maxErr}`);
assert(maxErr.includes('Please shorten your text to proceed'), `Expected shorten guidance, got: ${maxErr}`);

const minErr = formatUserFriendlyValidationError('Name must contain at least 2 characters.', 'Name');
assert(minErr.includes('must contain at least 2 characters'), `Expected min explanation, got: ${minErr}`);
assert(minErr.includes('Please enter a longer value'), `Expected longer guidance, got: ${minErr}`);

// 2.7 Date constraints
const dateErr = formatUserFriendlyValidationError('Due date must be valid.', 'Due Date');
assert(dateErr.includes('YYYY-MM-DD format'), `Expected date format guidance, got: ${dateErr}`);

const pastDateErr = formatUserFriendlyValidationError('Date cannot be in the past.', 'Close Date');
assert(pastDateErr.includes('cannot be in the past'), `Expected past explanation, got: ${pastDateErr}`);
assert(pastDateErr.includes('today\'s date or a future date'), `Expected future guidance, got: ${pastDateErr}`);

// 2.8 Password constraints
const pwErr = formatUserFriendlyValidationError('Passwords do not match.', 'Confirm Password');
assert(pwErr.includes('Passwords do not match'), `Expected mismatch explanation, got: ${pwErr}`);
assert(pwErr.includes('ensure both password fields are identical'), `Expected matching guidance, got: ${pwErr}`);

// 2.9 Dropdown selections
const selectErr = formatUserFriendlyValidationError('Select a category.', 'Category');
assert(selectErr.includes('Please select a category from the dropdown list'), `Expected dropdown guide, got: ${selectErr}`);

// 3. Test Global Zod Error Map with generic Zod schemas
const genericSchema = z.object({
  title: z.string().min(1),
  count: z.number().min(5),
  maxItems: z.string().max(10),
  category: z.enum(['A', 'B']),
});

const parseResult = genericSchema.safeParse({
  title: '',
  count: 2,
  maxItems: 'This is way too long for a title',
  category: 'C',
});

assert.equal(parseResult.success, false);
const issues = parseResult.error.issues;

const titleIssue = issues.find((i) => i.path[0] === 'title');
assert(titleIssue?.message.includes('Title is required') || titleIssue?.message.includes('enter a valid'), `Unexpected title issue: ${titleIssue?.message}`);

const countIssue = issues.find((i) => i.path[0] === 'count');
assert(countIssue?.message.includes('Count must be at least 5'), `Unexpected count issue: ${countIssue?.message}`);

const maxIssue = issues.find((i) => i.path[0] === 'maxItems');
assert(maxIssue?.message.includes('cannot exceed 10 characters'), `Unexpected maxItems issue: ${maxIssue?.message}`);

const catIssue = issues.find((i) => i.path[0] === 'category');
assert(catIssue?.message.includes('select a valid option') || catIssue?.message.includes('dropdown'), `Unexpected category issue: ${catIssue?.message}`);

// 4. Test ERP Domain Schemas
// 4.1 Customer schema
const invalidCustomer = customerSchema.safeParse({
  name: '',
  type: 'invalid',
  email: 'not-an-email',
  phone: 'abc',
  currency: 'TOOLONG',
  creditLimit: 10.5,
});
assert.equal(invalidCustomer.success, false);
const custErrors = invalidCustomer.error.flatten().fieldErrors;
assert(custErrors.name?.[0]?.includes('Customer name is required'), `Customer name error: ${custErrors.name?.[0]}`);
assert(custErrors.email?.[0]?.includes('name@company.com'), `Customer email error: ${custErrors.email?.[0]}`);
assert(custErrors.creditLimit?.[0]?.includes('whole number'), `Customer credit limit error: ${custErrors.creditLimit?.[0]}`);

// 4.2 Product schema
const invalidProduct = productFormSchema.safeParse({
  name: 'X',
  sku: 'invalid sku with spaces!',
  sellingPrice: -50,
  categoryId: '',
  type: 'goods',
  uomId: '',
});
assert.equal(invalidProduct.success, false);
const prodErrors = invalidProduct.error.flatten().fieldErrors;
assert(prodErrors.name?.[0]?.includes('Product name must contain at least 2 characters'), `Product name error: ${prodErrors.name?.[0]}`);
assert(prodErrors.sellingPrice?.[0]?.includes('Selling price cannot be negative'), `Product sellingPrice error: ${prodErrors.sellingPrice?.[0]}`);
assert(prodErrors.sku?.[0]?.includes('SKU contains invalid characters'), `Product SKU error: ${prodErrors.sku?.[0]}`);

// 4.3 Sales Order schema
const invalidSalesOrder = salesOrderSchema.safeParse({
  customerId: '',
  branchId: '',
  salespersonId: '',
  deliveryAddress: '',
  paymentTerms: '',
  currency: '',
  orderDate: '2026-11-20',
  expectedDeliveryDate: '2026-11-10', // Delivery before order!
  items: [],
});
assert.equal(invalidSalesOrder.success, false);
const salesIssues = invalidSalesOrder.error.issues;
const deliveryDateIssue = salesIssues.find(i => i.path.includes('expectedDeliveryDate'));
assert(deliveryDateIssue?.message.includes('Delivery date cannot be before order date'), `Delivery date issue: ${deliveryDateIssue?.message}`);

// 4.4 Warehouse schema
const invalidWarehouse = warehouseSchema.safeParse({
  name: '',
  branchId: '',
  address: '',
  type: 'invalid',
  isDefault: false,
  isActive: true,
});
assert.equal(invalidWarehouse.success, false);

// 4.5 Security / Login schema
const invalidLogin = loginSchema.safeParse({
  email: 'not-an-email',
  password: '',
  remember: true,
});
assert.equal(invalidLogin.success, false);
const loginErrors = invalidLogin.error.flatten().fieldErrors;
assert(loginErrors.email?.[0]?.includes('valid email address'), `Login email error: ${loginErrors.email?.[0]}`);
assert(loginErrors.password?.[0]?.includes('Password is required'), `Login password error: ${loginErrors.password?.[0]}`);

console.log('All form validation message and guidance QA checks passed successfully!');
