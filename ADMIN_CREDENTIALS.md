# Admin Portal Credentials

## Production Admin Access

**Username:** `admin`  
**Password:** `TeacherPortal@2025#Secure`

## Security Features
- Complex password with special characters, numbers, and mixed case
- Session-based authentication with automatic logout
- Protected routes requiring authentication
- Rate limiting: 100 requests per minute per IP
- Session storage prevents unauthorized access

## Access Instructions
1. Navigate to `/admin` route
2. Enter the credentials above
3. System will authenticate and redirect to admin dashboard
4. Use "Logout" button to securely end session

## Available Admin Functions
- Teacher Management: Search, add, edit teacher profiles
- Batch Management: Create and manage training batches
- Assessment Control: Enable/disable dates and topics
- System Reports: View comprehensive analytics
- Bulk Import: Import teacher data from CSV files

## Security Notes
- Password is case-sensitive
- Session expires on browser close
- Failed login attempts are logged
- Admin access is monitored for security

## Production Deployment
- Change default credentials before deployment
- Consider implementing environment-based authentication
- Add two-factor authentication for enhanced security
- Monitor admin access logs regularly