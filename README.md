# TWS Community Marketplace

MVP marketplace tiếng Việt cho cộng đồng TWS: thành viên đăng nhập Facebook, đăng và tìm sản phẩm mới/secondhand, liên hệ người bán, báo cáo nội dung và nhờ admin hỗ trợ trung gian miễn phí.

## Kiến trúc

- `apps/web`: Next.js App Router, React, TypeScript
- `apps/api`: NestJS REST API, Passport Facebook OAuth, JWT trong HTTP-only cookie
- `apps/api/prisma`: PostgreSQL schema và seed
- `packages/shared-types`: kiểu dữ liệu dùng chung

Backend là một modular monolith, không có microservices. Web có dữ liệu demo để xem UI ngay cả khi chưa cấu hình dịch vụ bên ngoài.

## Chạy local

Yêu cầu Node.js 24+, pnpm và Docker.

### Chạy/dừng toàn bộ service trên Windows

Double-click hai file ở thư mục gốc:

- `start-all.cmd`: khởi động PostgreSQL, chuẩn bị database, chạy API và web.
- `stop-all.cmd`: đóng web, API và PostgreSQL.

Hoặc chạy trong PowerShell:

```powershell
pnpm services:start
pnpm services:stop
```

Log và PID được lưu tạm trong `.runtime/`. Có thể giữ PostgreSQL chạy khi đóng web/API bằng:

```powershell
.\scripts\stop-all.ps1 -KeepDatabase
```

Mở Prisma Studio bằng lệnh sau từ thư mục gốc dự án:

```powershell
pnpm db:studio
```

Lệnh này nạp `DATABASE_URL` từ file `.env` ở thư mục gốc rồi mở Studio tại
`http://localhost:5555`. Chạy `prisma studio` trực tiếp bên trong `apps/api`
sẽ không tự thấy file `.env` gốc.

```bash
pnpm install
Copy-Item .env.example .env
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:4000/api/v1
- Swagger: http://localhost:4000/api/docs

Chỉ chạy giao diện:

```bash
pnpm dev:web
```

## Tài khoản quản trị

Admin dùng email và mật khẩu tại `http://localhost:3000/login` bằng tab Admin, hoàn
toàn tách khỏi Facebook Login. Mật khẩu được băm trước khi lưu và cookie phiên
đăng nhập là HTTP-only.

Để cấp tài khoản admin đầu tiên trên máy local, chạy:

```powershell
pnpm admin:create
```

Script sẽ hỏi tên, email và mật khẩu (tối thiểu 12 ký tự, có chữ hoa, chữ
thường và chữ số). Sau khi đăng nhập, admin đầu tiên có thể mở trang
`/admin` và dùng mục **Tài khoản quản trị** để cấp thêm admin. Không có tài
khoản hoặc mật khẩu admin mặc định trong source code.

Ngoài bootstrap tương tác, `pnpm db:seed` có thể tạo admin đầu tiên từ ba biến
`SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL` và `SEED_ADMIN_PASSWORD`. Seed chỉ tạo
khi email chưa có credential admin và không ghi đè mật khẩu ở những lần chạy
sau. Trên production, đặt các biến này trong secret manager và dùng một mật
khẩu riêng đủ mạnh; không commit mật khẩu vào repository.

Admin có thể đổi mật khẩu của chính mình trong trang `/admin`. Hệ thống yêu
cầu mật khẩu hiện tại, mật khẩu mới tối thiểu 12 ký tự có chữ hoa, chữ thường
và chữ số, đồng thời ghi lại sự kiện đổi mật khẩu trong audit log. Sau khi đổi,
các phiên admin cũ bị vô hiệu hóa và admin cần đăng nhập lại.

Hai tài khoản thành viên demo có thể được cấu hình bằng các nhóm biến
`SEED_DEMO_USER_1_*` và `SEED_DEMO_USER_2_*`. Chúng đăng nhập tại `/login`
bằng email/mật khẩu nhưng luôn giữ role `USER`, được chuyển về marketplace và
không có quyền truy cập dashboard hay API quản trị. Seed chạy lặp lại an toàn và
không ghi đè mật khẩu đã tồn tại. Thông tin liên hệ của tài khoản demo là dữ liệu
giả lập, không đại diện cho người dùng thật và không nên bật trên production.

## Cấu hình đăng nhập Google và email OTP

1. Tạo OAuth 2.0 Client loại Web application trong Google Cloud Console.
2. Thêm callback local: `http://localhost:4000/api/v1/auth/google/callback`.
3. Điền `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` và `GOOGLE_CALLBACK_URL`.
4. Để gửi OTP bằng Resend, xác minh domain `taskflow-planner.site`, tạo API key
   rồi cấu hình `RESEND_API_KEY` và
   `RESEND_FROM=taskflow-planner <login@taskflow-planner.site>`. Nếu không có
   Resend, hệ thống vẫn hỗ trợ fallback qua `SMTP_HOST`, `SMTP_PORT`,
   `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` và `MAIL_FROM`.
5. Local có thể đặt `EMAIL_OTP_DEV_ECHO=true` để API trả mã kiểm thử mà không
   gửi mail. Production luôn bỏ qua chế độ này khi `NODE_ENV=production`.
6. Với production, đặt đúng `WEB_URL`, bật `COOKIE_SECURE=true` và dùng một
   `JWT_SECRET` ngẫu nhiên dài.

Google chỉ được dùng khi trả về email đã xác minh. OTP email hết hạn sau 10
phút, tối đa 5 lần nhập sai, chỉ dùng một lần và được lưu dưới dạng bản băm.
Người dùng xác nhận đã đọc cam kết bảo vệ số điện thoại và URL Facebook của nền
tảng; thời điểm và phiên bản xác nhận được lưu cùng tài khoản. Nghĩa vụ sử dụng
thông tin liên hệ của thành viên khác được quy định trong Điều khoản sử dụng.
Facebook OAuth cũ vẫn còn ở backend để không làm mất liên kết của tài khoản đã
tồn tại, nhưng không còn là lựa chọn đăng nhập chính.

## Phạm vi MVP đã triển khai

- Marketplace responsive, tìm kiếm, lọc danh mục/tình trạng, sắp xếp và trang chi tiết.
- Google OAuth và email OTP do backend quản lý; application session không lưu trong localStorage. Người dùng có thể chọn cookie HTTP-only duy trì đăng nhập trong 30 ngày; nếu không chọn, cookie chỉ tồn tại theo phiên trình duyệt và JWT hết hạn sau 15 phút.
- Tab admin trên trang đăng nhập chung dùng email/mật khẩu, giới hạn số lần thử và cho phép admin đang hoạt động cấp thêm tài khoản admin. Admin không đăng nhập qua Google hoặc OTP.
- Sau giao dịch hoàn tất, người mua và người bán có thể đánh giá đối phương một lần với thang 1–5 sao. Hồ sơ thành viên công khai số giao dịch bán hoàn tất, điểm trung bình và các đánh giá gần đây gắn với bài đăng thực tế.
- Thành viên có thể tố cáo tài khoản khác; phiếu tố cáo được lưu riêng và hiển thị trong dashboard admin. Khi xác nhận vi phạm, admin có thể khóa riêng quyền đăng bài mà không khóa đăng nhập, ghi lý do xử lý và cấp lại quyền sau đó. Mỗi thay đổi đều tạo thông báo chưa đọc cho thành viên và audit log cho admin.
- Prisma domain model cho user, auth identity, listing, image, favorite, report, mediation, notification và audit log.
- API public listing/category và các endpoint có xác thực cho tạo bài, xem liên hệ, report, trung gian.
- Chế độ đăng nhiều món dùng chung một bộ ảnh: hệ thống tạo listing, giá và trạng thái giao dịch độc lập cho từng món. Ảnh được lưu cục bộ khi phát triển hoặc tự động chuyển sang Cloudinary khi cấu hình đủ ba biến `CLOUDINARY_*`.
- Mỗi sản phẩm có mã công khai `SP-…`; mỗi lần đăng có mã ngắn `D-123456` và được hiển thị thân thiện thành “Đơn #123456”. Các sản phẩm dùng chung ảnh dùng chung một mã đơn nhưng vẫn có mã sản phẩm riêng. Thanh tìm kiếm nhận cả hai loại mã và không lộ khóa CUID nội bộ của database.
- Mỗi listing có tổng số lượng, số đang được giữ cho giao dịch, số đã bán và số còn trống. Yêu cầu mua được cấp tối đa theo tồn kho thực tế; khi hết phần trống, người mua mới tự vào queue FIFO. Hủy một đơn sẽ trả tồn và tự động cấp cho queue, còn listing chỉ chuyển `SOLD` khi toàn bộ số lượng đã hoàn tất.
- Tìm kiếm chạy phía server, bỏ dấu tiếng Việt, hiểu một số cách gọi tương đương như “sạc dự phòng / power bank” và “cáp sạc / dây sạc”, đồng thời ưu tiên kết quả khớp tên món trước mô tả.

Kiểm thử riêng cho phân bổ tồn kho và queue:

```bash
pnpm test:inventory
```

Kiểm thử end-to-end bằng đúng hai tài khoản demo đã seed, bao gồm mua bán, đánh giá, tố cáo và khóa/khôi phục quyền đăng:

```bash
pnpm test:demo-flow
```

- Form đăng bán ba bước, trang tài khoản, admin dashboard, quy tắc, privacy và terms.
- OpenAPI/Swagger, DTO validation, CORS, Helmet và rate limiting.

## Cần cấu hình trước production

- Meta App Review, privacy policy và domain chính thức.
- Cloudinary signed upload (UI upload hiện là demo).
- Database backup, monitoring và migration production.
- Thay dữ liệu demo frontend bằng TanStack Query gọi API sau khi database có seed sản phẩm.
- Bổ sung kiểm thử e2e cho OAuth callback trên một Meta test app.
