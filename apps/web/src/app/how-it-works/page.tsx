import {
  CheckCircle2,
  ClipboardPenLine,
  Handshake,
  Hourglass,
  MessageCircleMore,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingBag,
  Star,
  ThumbsDown,
  UserRoundCheck,
} from "lucide-react";
import Link from "next/link";

const sellerSteps = [
  {
    icon: ClipboardPenLine,
    title: "Đăng thông tin bán",
    text: "Thêm ảnh thật, tên từng sản phẩm, tình trạng, giá, số lượng và phương thức giao nhận. Các món chụp chung vẫn có tồn kho riêng.",
  },
  {
    icon: MessageCircleMore,
    title: "Tiếp nhận yêu cầu mua",
    text: "Khi người mua liên hệ, hệ thống giữ số lượng còn trống. Người bán xem từng đơn đang giao dịch và danh sách queue.",
  },
  {
    icon: Handshake,
    title: "Trao đổi trực tiếp hoặc qua admin",
    text: "Hai bên có thể tự thống nhất giá, giao nhận và thanh toán; hoặc chọn hỗ trợ trung gian để admin theo dõi giao dịch.",
  },
  {
    icon: ThumbsDown,
    title: "Quyết định bán hoặc không bán",
    text: "Nếu không đạt thỏa thuận, người bán hủy giao dịch. Số lượng được trả lại và hệ thống tự cấp cho người đầu queue.",
  },
  {
    icon: PackageCheck,
    title: "Xác nhận lại trên website",
    text: "Sau khi giao hàng thành công, người bán chọn Đã bán. Với giao dịch trung gian, admin là người xác nhận hoàn tất.",
  },
];

const buyerSteps = [
  {
    icon: Search,
    title: "Tìm và mở bài đăng",
    text: "Tìm theo tên, danh mục, mã sản phẩm SP-… hoặc mã đơn D-… rồi mở sản phẩm muốn mua.",
  },
  {
    icon: UserRoundCheck,
    title: "Kiểm tra thông tin",
    text: "Xem ảnh, tình trạng, giá, số lượng còn lại, phương thức giao nhận và hồ sơ người bán trước khi quyết định.",
  },
  {
    icon: ShoppingBag,
    title: "Chọn số lượng và liên hệ",
    text: "Nhập số lượng muốn mua rồi bấm liên hệ. Nếu tồn kho không đủ, hệ thống chỉ giữ phần còn lại; hết hàng sẽ đưa yêu cầu vào queue.",
  },
  {
    icon: ShieldCheck,
    title: "Tự thỏa thuận hoặc nhờ admin",
    text: "Người mua có thể trao đổi trực tiếp với người bán hoặc gửi yêu cầu hỗ trợ trung gian qua admin cộng đồng.",
  },
  {
    icon: Hourglass,
    title: "Chờ kết quả giao dịch",
    text: "Chờ người bán giao hàng và xác nhận; hoặc nhận thông báo từ chối/hủy. Khi có hàng trả lại, queue được kích hoạt tự động theo thứ tự.",
  },
];

export default function HowItWorksPage() {
  return (
    <main className="guide-page">
      <header className="guide-hero">
        <span className="section-kicker">HƯỚNG DẪN MUA BÁN</span>
        <h1>
          Hai phía, một quy trình
          <br />
          <em>rõ ràng từ đầu đến cuối.</em>
        </h1>
        <p>
          Website giúp ghi nhận bài đăng, số lượng, queue và trạng thái. Việc
          kiểm tra sản phẩm, thỏa thuận và thanh toán vẫn do người mua và người
          bán thống nhất.
        </p>
      </header>

      <section
        className="dual-guide"
        aria-label="Quy trình người bán và người mua"
      >
        <article className="guide-flow seller-flow">
          <header>
            <span>01</span>
            <div>
              <small>PHÍA NGƯỜI BÁN</small>
              <h2>Từ đăng bài đến xác nhận đã bán</h2>
            </div>
          </header>
          <ol>
            {sellerSteps.map(({ icon: Icon, title, text }, index) => (
              <li key={title}>
                <b>{index + 1}</b>
                <span className="guide-step-icon">
                  <Icon size={19} />
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ol>
          <Link className="button button-primary" href="/account/listings/new">
            Đăng sản phẩm
          </Link>
        </article>

        <article className="guide-flow buyer-flow">
          <header>
            <span>02</span>
            <div>
              <small>PHÍA NGƯỜI MUA</small>
              <h2>Từ tìm sản phẩm đến nhận kết quả</h2>
            </div>
          </header>
          <ol>
            {buyerSteps.map(({ icon: Icon, title, text }, index) => (
              <li key={title}>
                <b>{index + 1}</b>
                <span className="guide-step-icon">
                  <Icon size={19} />
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ol>
          <Link className="button button-outline" href="/marketplace">
            Khám phá sản phẩm
          </Link>
        </article>
      </section>

      <section className="guide-shared-finish">
        <span className="guide-finish-icon">
          <Star size={28} fill="currentColor" />
        </span>
        <div>
          <span className="section-kicker light">
            BƯỚC CUỐI CỦA CẢ HAI PHÍA
          </span>
          <h2>Đánh giá trải nghiệm của nhau</h2>
          <p>
            Khi giao dịch hoàn tất, người mua và người bán có thể chấm từ 1–5
            sao và để lại nhận xét. Đánh giá được gắn với giao dịch thật và hiển
            thị trên hồ sơ thành viên.
          </p>
        </div>
        <CheckCircle2 size={34} />
      </section>

      <p className="guide-more-links">
        Cần biết thêm?{" "}
        <Link href="/community-guidelines">Xem quy tắc cộng đồng và FAQ</Link>
      </p>
    </main>
  );
}
