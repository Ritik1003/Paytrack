// Allowed office IPs (can be single IPs or CIDR ranges in the future)
// For local development you can set OFFICE_IPS env var as a comma-separated list.
const raw = process.env.OFFICE_IPS || "";
const list = raw
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

module.exports = {
  allowed: list,
};
