import {
  BookOpenCheck,
  ExternalLink,
  Eye,
  HeartHandshake,
  LockKeyhole,
  MessageCircleQuestion,
  ShieldCheck,
  Tag,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ADMIN_FACEBOOK_URL, FEEDBACK_FORM_URL } from "@/lib/constants";

const rules = [
  {
    n: "01",
    icon: Eye,
    title: "Thông tin trung thực",
    text: "Ảnh thật, mô tả đúng tình trạng và công khai mọi khuyết điểm của sản phẩm.",
  },
  {
    n: "02",
    icon: Tag,
    title: "Giá bán rõ ràng",
    text: "Mọi bài đăng phải có giá lớn hơn 0. Không để giá ảo hoặc yêu cầu inbox báo giá.",
  },
  {
    n: "03",
    icon: HeartHandshake,
    title: "Giao tiếp tử tế",
    text: "Tôn trọng thời gian, quyết định và quyền riêng tư của cả người mua lẫn người bán.",
  },
  {
    n: "04",
    icon: ShieldCheck,
    title: "Cùng nhau giữ an toàn",
    text: "Báo cáo nội dung đáng ngờ và nhờ admin hỗ trợ khi bạn cảm thấy chưa an tâm.",
  },
];

const faqGroups = [
  {
    icon: LockKeyhole,
    title: "Quyền riêng tư",
    items: [
      {
        question: "Website nhận được thông tin gì khi tôi đăng nhập?",
        answer:
          "Google cung cấp mã tài khoản theo ứng dụng, tên hiển thị, email và ảnh đại diện. Với đăng nhập email, website chỉ xác nhận quyền sở hữu email bằng mã OTP dùng một lần; website không nhận mật khẩu Google hoặc mật khẩu email của bạn.",
      },
      {
        question: "Số điện thoại và đường dẫn Facebook có được xác minh không?",
        answer:
          "URL Facebook và số điện thoại do người dùng nhập tay chỉ được kiểm tra định dạng, không được Google, Meta hoặc website tự động xác minh. Hãy đối chiếu thông tin và nhờ admin hỗ trợ nếu có dấu hiệu giả mạo.",
      },
      {
        question: "Khi nào thông tin liên hệ của tôi được hiển thị?",
        answer:
          "Số điện thoại và URL Facebook chỉ được trả về cho thành viên đã đăng nhập khi họ chủ động bắt đầu liên hệ mua bán, và cho admin khi cần hỗ trợ an toàn. TWS Community Market cam kết bảo vệ, không bán cho nhà quảng cáo và không đưa các thông tin này vào email OTP. Thành viên nhận được thông tin phải tuân thủ Điều khoản sử dụng.",
      },
      {
        question: "Vì sao email OTP mang tên taskflow-planner?",
        answer:
          "Website dùng hạ tầng email của dự án cũ taskflow-planner.site để gửi mã. Email hợp lệ có người gửi hiển thị là taskflow-planner, mã gồm 6 số và hết hạn sau 10 phút. Nếu chưa thấy, hãy kiểm tra cả Spam hoặc Thư rác.",
      },
    ],
  },
  {
    icon: ShieldCheck,
    title: "Trách nhiệm & an toàn",
    items: [
      {
        question: "Marketplace có giữ tiền hoặc bảo đảm giao dịch không?",
        answer:
          "Không. Nền tảng không xử lý thanh toán, không giữ tiền và không cung cấp dịch vụ ký quỹ. Hai bên chịu trách nhiệm kiểm tra sản phẩm, thống nhất phương thức giao nhận và bảo vệ thông tin cá nhân.",
      },
      {
        question: "Admin hỗ trợ trung gian đến mức nào?",
        answer:
          "Admin hỗ trợ kết nối, theo dõi yêu cầu và có thể xác nhận hoàn tất giao dịch trung gian. Việc hỗ trợ không thay thế trách nhiệm kiểm tra sản phẩm và thanh toán của người mua, người bán.",
      },
      {
        question: "Tôi nên làm gì khi thấy bài đăng đáng ngờ?",
        answer:
          "Không chuyển tiền trước khi kiểm tra đầy đủ. Hãy dừng trao đổi, lưu lại thông tin cần thiết và liên hệ admin cộng đồng để được hướng dẫn.",
      },
    ],
  },
  {
    icon: BookOpenCheck,
    title: "Hướng dẫn sử dụng",
    items: [
      {
        question: "Làm thế nào để bắt đầu mua một sản phẩm?",
        answer:
          "Mở trang chi tiết và chọn Liên hệ người bán. Nếu sản phẩm đang trống, bạn trở thành người mua hiện tại và sản phẩm chuyển sang Đang giao dịch.",
      },
      {
        question: "Hàng chờ hoạt động như thế nào?",
        answer:
          "Khi đã có người mua hiện tại, thành viên khác có thể tham gia hàng chờ. Nếu giao dịch đầu tiên không thành công, người bán có thể chủ động chọn một người khác trong danh sách.",
      },
      {
        question: "Khi nào sản phẩm được đánh dấu Đã bán?",
        answer:
          "Với giao dịch trực tiếp, người bán chọn Đã bán. Với giao dịch trung gian, sản phẩm chuyển sang Đã bán sau khi admin xác nhận hoàn tất.",
      },
    ],
  },
];

export default function GuidelinesPage() {
  return (
    <main className="legal-page">
      <header>
        <span className="section-kicker">QUY TẮC CỘNG ĐỒNG</span>
        <h1>
          Một marketplace tốt
          <br />
          được xây bằng <em>sự tử tế.</em>
        </h1>
        <p>
          Những nguyên tắc nhỏ giúp mỗi giao dịch minh bạch, an toàn và dễ chịu
          hơn cho tất cả thành viên.
        </p>
      </header>

      <section className="rule-grid">
        {rules.map(({ n, icon: Icon, title, text }) => (
          <article key={n}>
            <span>{n}</span>
            <Icon />
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </section>

      <section className="faq-section" aria-labelledby="faq-title">
        <div className="guidelines-section-heading">
          <span className="section-kicker">
            <MessageCircleQuestion size={15} /> CÂU HỎI THƯỜNG GẶP
          </span>
          <h2 id="faq-title">Thông tin cần biết trước khi giao dịch</h2>
          <p>
            Các câu trả lời dưới đây mô tả đúng phạm vi dữ liệu và cách hoạt
            động hiện tại của marketplace.
          </p>
        </div>
        <div className="faq-groups">
          {faqGroups.map(({ icon: Icon, title, items }) => (
            <article className="faq-group" key={title}>
              <header>
                <Icon size={19} />
                <h3>{title}</h3>
              </header>
              {items.map(({ question, answer }) => (
                <details key={question}>
                  <summary>{question}</summary>
                  <p>{answer}</p>
                </details>
              ))}
            </article>
          ))}
        </div>
        <p className="faq-legal-links">
          Thông tin chi tiết: <Link href="/privacy">Quyền riêng tư</Link>
          <span>·</span>
          <Link href="/terms">Điều khoản sử dụng</Link>
        </p>
      </section>

      <section
        className="admin-contact-section"
        aria-labelledby="admin-contact-title"
      >
        <Image
          src="/brand/admin-profile.png"
          alt="Admin cộng đồng Cuồng Tai Nghe TWS"
          width={84}
          height={84}
        />
        <div>
          <span className="section-kicker light">HỖ TRỢ CỘNG ĐỒNG</span>
          <h2 id="admin-contact-title">Bạn vẫn cần admin hỗ trợ?</h2>
          <p>
            Liên hệ admin khi cần hỗ trợ giao dịch hoặc gặp nội dung đáng ngờ.
            Với lỗi kỹ thuật và đề xuất cải thiện website, hãy gửi qua biểu mẫu
            góp ý để thông tin được ghi nhận đầy đủ.
          </p>
        </div>
        <div className="admin-contact-actions">
          <a
            className="button button-light"
            href={ADMIN_FACEBOOK_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Liên hệ Facebook <ExternalLink size={15} />
          </a>
          <a
            className="button button-outline-light"
            href={FEEDBACK_FORM_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Báo lỗi & góp ý <ExternalLink size={15} />
          </a>
        </div>
      </section>
    </main>
  );
}
