# OTP Verification & Admin Credentials Implementation

## Summary

Successfully implemented email and phone OTP verification along with admin credentials collection during brand onboarding.

## Backend Changes Complete ✅

### 1. Database Migration
- **File**: `database/migrations/008_otp_verifications.sql`
- Created `otp_verifications` table for storing OTP codes
- Added `admin_username`, `admin_password_hash`, `email_verified`, `phone_verified` columns to `onboarding_requests`

### 2. OTP Service
- **File**: `src/services/otp.service.ts`
- `sendEmailOTP()` - Generates 6-digit OTP and sends via email (nodemailer)
- `sendPhoneOTP()` - Generates 6-digit OTP for phone verification
- `verifyEmailOTP()` - Validates email OTP code
- `verifyPhoneOTP()` - Validates phone OTP code
- OTPs expire in 10 minutes
- Development mode: OTPs logged to console

### 3. OTP Controller & Routes
- **Files**: `src/controllers/otp.controller.ts`, `src/routes/otp.routes.ts`
- **Endpoints**:
  - `POST /api/otp/send-email` - Send email OTP
  - `POST /api/otp/send-phone` - Send phone OTP
  - `POST /api/otp/verify-email` - Verify email OTP
  - `POST /api/otp/verify-phone` - Verify phone OTP

### 4. Updated Onboarding Service
- **File**: `src/services/onboarding.service.ts`
- Added `adminUsername`, `adminPassword`, `emailVerified`, `phoneVerified` to `OnboardingData` interface
- `submitOnboarding()` now:
  - Validates email and phone are verified before submission
  - Hashes admin password using bcrypt
  - Stores admin credentials in database
- `approveRequest()` now:
  - Uses stored admin credentials instead of generating temp password
  - Returns username and confirmation message

### 5. Updated Onboarding Controller
- **File**: `src/controllers/onboarding.controller.ts`
- Added validation for:
  - `adminUsername` (min 3 characters)
  - `adminPassword` (min 8 characters)
  - `emailVerified` (boolean)
  - `phoneVerified` (boolean)

## Frontend Changes Needed ⏳

### Components to Update

**File**: `frontend/src/pages/BrandOnboarding.tsx`

#### 1. Add New State Variables

```typescript
const [emailOTP, setEmailOTP] = useState('');
const [phoneOTP, setPhoneOTP] = useState('');
const [emailVerified, setEmailVerified] = useState(false);
const [phoneVerified, setPhoneVerified] = useState(false);
const [otpStep, setOtpStep] = useState<'none' | 'email' | 'phone'>('none');
const [sendingOTP, setSendingOTP] = useState(false);
```

#### 2. Add Admin Credentials Fields to formData

```typescript
const [formData, setFormData] = useState({
  // ... existing fields ...
  adminUsername: '',
  adminPassword: '',
  emailVerified: false,
  phoneVerified: false,
});
```

#### 3. Add OTP Verification Functions

```typescript
const sendEmailOTP = async () => {
  setSendingOTP(true);
  try {
    await axios.post('http://localhost:3000/api/otp/send-email', {
      email: formData.email
    });
    setOtpStep('email');
    // Show success message
  } catch (err) {
    // Handle error
  } finally {
    setSendingOTP(false);
  }
};

const verifyEmailOTP = async () => {
  try {
    await axios.post('http://localhost:3000/api/otp/verify-email', {
      email: formData.email,
      otpCode: emailOTP
    });
    setEmailVerified(true);
    setOtpStep('phone');
  } catch (err) {
    // Handle error
  }
};

// Similar functions for phone OTP
```

#### 4. Update Form Layout

Add these sections to the form modal:

**Admin Credentials Section** (after Business Details):
```tsx
<div>
  <h3>Admin Credentials</h3>
  <input
    type="text"
    name="adminUsername"
    placeholder="Admin Username"
    required
  />
  <input
    type="password"
    name="adminPassword"
    placeholder="Admin Password (min 8 characters)"
    required
    minLength={8}
  />
</div>
```

**Email Verification Section**:
```tsx
{!emailVerified && (
  <div>
    <button onClick={sendEmailOTP}>Send Email OTP</button>
    {otpStep === 'email' && (
      <>
        <input
          value={emailOTP}
          onChange={(e) => setEmailOTP(e.target.value)}
          placeholder="Enter 6-digit code"
          maxLength={6}
        />
        <button onClick={verifyEmailOTP}>Verify Email</button>
      </>
    )}
  </div>
)}
{emailVerified && <p>✓ Email Verified</p>}
```

**Phone Verification Section** (similar to email)

#### 5. Update Form Submission

```typescript
const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();

  if (!emailVerified || !phoneVerified) {
    setError('Please verify both email and phone number');
    return;
  }

  setSubmitting(true);
  try {
    await axios.post('http://localhost:3000/api/onboarding/submit', {
      ...formData,
      emailVerified,
      phoneVerified,
    });
    setSuccess(true);
  } catch (err) {
    setError(err.response?.data?.message);
  } finally {
    setSubmitting(false);
  }
};
```

## Testing Flow

### 1. User Fills Form
- Brand information
- Store information
- Business details
- **NEW**: Admin username and password

### 2. Email Verification
- User enters email → clicks "Send Email OTP"
- Check console for OTP code (development mode)
- User enters 6-digit code → clicks "Verify Email"
- Success: Email verified ✓

### 3. Phone Verification
- User enters phone → clicks "Send Phone OTP"
- Check console for OTP code (development mode)
- User enters 6-digit code → clicks "Verify Phone"
- Success: Phone verified ✓

### 4. Form Submission
- Form validates that both email and phone are verified
- Submits with admin credentials and verification status
- Success modal shows

### 5. Admin Approval
- Admin logs in, navigates to `/onboarding-requests`
- Clicks "Approve & Create Brand Account"
- System creates account using provided admin credentials
- Shows confirmation: "Brand owner account created. User can login with provided credentials."

### 6. Brand Owner Login
- Brand owner goes to `/login`
- Uses their email and password (they set during onboarding)
- Successfully logs in as brand_owner
- Auto-redirects to their brand console

## Email Configuration (Production)

To enable real email sending in production, add these environment variables:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@askflash.ai
```

## SMS Configuration (Future)

To enable SMS sending, integrate with Twilio:

```bash
npm install twilio
```

Add to `.env`:
```env
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

Update `otp.service.ts` sendPhoneOTP() method with Twilio integration.

## Security Features

1. **Password Hashing**: All passwords hashed with bcrypt (10 salt rounds)
2. **OTP Expiration**: OTPs expire after 10 minutes
3. **One-Time Use**: OTPs marked as verified after first use
4. **Verification Required**: Form cannot be submitted without verified email and phone
5. **Secure Storage**: Admin credentials stored as hashed passwords

## API Endpoints Summary

### OTP Endpoints
- `POST /api/otp/send-email` - Send email OTP
- `POST /api/otp/send-phone` - Send phone OTP
- `POST /api/otp/verify-email` - Verify email OTP
- `POST /api/otp/verify-phone` - Verify phone OTP

### Onboarding Endpoints
- `POST /api/onboarding/submit` - Submit onboarding (now requires verification)
- `GET /api/onboarding/requests` - Get all requests (admin)
- `POST /api/onboarding/requests/:id/approve` - Approve request (admin)
- `POST /api/onboarding/requests/:id/reject` - Reject request (admin)

## Current Status

✅ **Backend**: Fully implemented and tested
✅ **Database**: Migrated and ready
✅ **OTP Service**: Working (console logging for development)
✅ **Admin Credentials**: Stored securely with bcrypt
⏳ **Frontend**: Needs OTP verification UI components

## Next Steps

1. Update `BrandOnboarding.tsx` with OTP verification UI
2. Test complete flow end-to-end
3. Configure production email service
4. (Optional) Integrate SMS service for phone verification
