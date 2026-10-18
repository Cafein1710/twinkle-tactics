// public/js/app.js - Điều khiển luồng trận đấu, Cẩm nang Hướng dẫn, Liên hệ Discord (cafe_1710), Pre-game & Race Viewer

const socket = io();
let currentRoomCode = '';
let umaPool = [];
let supportPool = [];
let currentMapsList = [];
let selectedUmaIds = [];   // Bắt đầu từ 0/3 Uma (người chơi tự chọn)
let selectedDeckUids = []; // Bắt đầu từ 0/40 Card (người chơi tự chọn hoặc bấm nút Chọn Nhanh)
let allocatedSparks = {};
let currentUmaFilter = 'ALL';
let currentCardTypeFilter = 'ALL';
let currentPreGameStep = 1;
let countdownInterval = null;
let revealTimers = [];
let draggedPayload = null;
let lastAnimatedUmaIndex = null;
let latestGameState = null;

let sessionToken = localStorage.getItem('twinkle_session_token');
if (!sessionToken) {
  sessionToken = 'user_' + Math.random().toString(36).substring(2, 11);
  localStorage.setItem('twinkle_session_token', sessionToken);
}

const RANKS = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S'];

// =========================================================================
// HỆ THỐNG CẨM NANG HƯỚNG DẪN TÂN THỦ & HUY HIỆU LIÊN HỆ DISCORD (cafe_1710)
// =========================================================================
const GAME_GUIDE_SECTIONS = [
  {
    id: 'overview',
    menuTitle: '1. Tổng Quan & Thể Thức',
    heading: 'Tổng Quan Trò Chơi & Thể Thức Thi Đấu',
    content: `
      <p><strong>Twinkle Tactics: Card Derby</strong> là trò chơi chiến thuật đối kháng thời gian thực (1v1), kết hợp giữa quy trình huấn luyện nhân vật của <em>Uma Musume: Pretty Derby</em> và cơ chế xây dựng, vận hành bộ bài hỗ trợ (Support Deck).</p>

      <h4>Mục Tiêu Chiến Thắng</h4>
      <ul>
        <li>Mỗi người chơi quản lý một đội hình gồm <strong>3 Uma chủ lực</strong>, trải qua <strong>3 Năm huấn luyện</strong> (Junior, Classic, Senior).</li>
        <li>Cuối mỗi năm (sau lượt huấn luyện thứ 10), toàn bộ 6 Uma của hai người chơi sẽ bước vào tranh tài trực tiếp trên <strong>2 chặng đua liên tiếp</strong>.</li>
        <li>Cơ chế tính điểm mỗi chặng đua:
          <ul>
            <li><strong>Hạng 1:</strong> Cộng 4 điểm</li>
            <li><strong>Hạng 2:</strong> Cộng 2 điểm</li>
            <li><strong>Hạng 3:</strong> Cộng 1 điểm</li>
            <li><strong>Hạng 4 đến Hạng 6:</strong> 0 điểm</li>
          </ul>
        </li>
        <li>Người chơi đầu tiên đạt hoặc vượt mốc <strong>25 điểm</strong> (và có điểm số cao hơn đối thủ) sẽ giành chiến thắng chung cuộc. Nếu sau 6 chặng đua chính thức vẫn chưa có ai chạm mốc 25 điểm hoặc hai bên hòa điểm, trận đấu sẽ bước vào <strong>Chặng 7 (Tie-break)</strong> để phân định thắng thua.</li>
      </ul>

      <div class="guide-diff-box">
        <div class="guide-diff-title">Điểm Tinh Chỉnh So Với Bản Gốc</div>
        <p>Trong phiên bản gốc, người chơi huấn luyện từng nhân vật riêng lẻ qua một kịch bản dài trước khi đem đi thi đấu. Trong <em>Twinkle Tactics</em>, quá trình huấn luyện và thi đấu diễn ra song song trong cùng một trận đấu đối kháng. Bạn phải vừa phát triển chỉ số cho cả 3 nhân vật cùng lúc, vừa quan sát đội hình đối phương để điều chỉnh chiến thuật theo từng chặng đua.</p>
      </div>
    `
  },
  {
    id: 'pregame',
    menuTitle: '2. Giai Đoạn Chuẩn Bị',
    heading: 'Giai Đoạn Chuẩn Bị Trước Trận (Pre-Game)',
    content: `
      <p>Ngay khi hai người chơi vào phòng, hệ thống sẽ công bố danh sách <strong>7 Sân đua</strong> của trận đấu (gồm 6 chặng chính thức chia đều cho 3 năm và 1 chặng Tie-break). Bạn có thể nhấp chuột vào bất kỳ sân nào ở cột bên trái để mở bảng phân tích địa hình (Map Helper) nhằm kiểm tra cự ly, mặt sân, mùa giải và vị trí các con dốc.</p>

      <h4>Quy Trình 3 Bước Chuẩn Bị</h4>
      <ul>
        <li><strong>Bước 1 — Chọn 3 Uma Chủ Lực:</strong> Lựa chọn 3 nhân vật phù hợp với các cự ly xuất hiện trong danh sách 7 sân đua. Bạn có thể nhấp chuột phải vào từng nhân vật để xem chi tiết chỉ số cơ bản, kỹ năng độc quyền (Unique Skill) và các kỹ năng tiềm năng có sẵn (Pot Skills).</li>
        <li><strong>Bước 2 — Phân Bổ 18 Spark Hồng:</strong> Mỗi nhân vật được cấp 18 điểm Spark Hồng để nâng cấp bậc thích nghi Mặt sân, Cự ly hoặc Chiến thuật chạy. Trước khi trận đấu bắt đầu, Spark Hồng có thể nâng bậc thích nghi tối đa lên mức <strong>A</strong> (1 Spark tăng 1 bậc, 4 Spark tăng 2 bậc, 7 Spark tăng 3 bậc, 10 Spark tăng 4 bậc).</li>
        <li><strong>Bước 3 — Xây Dựng Bộ Bài 40 Thẻ SSR:</strong> Chọn đủ 40 thẻ Hỗ trợ (Support Cards) từ kho thẻ. Mỗi hệ chỉ số (Speed, Stamina, Power, Guts, Wit) được phép lấy tối đa 12 thẻ.</li>
      </ul>

      <div class="guide-diff-box">
        <div class="guide-diff-title">Điểm Tinh Chỉnh So Với Bản Gốc</div>
        <ul>
          <li><strong>Cơ chế Kế thừa (Inheritance):</strong> Thay vì chọn ngựa bố mẹ có sẵn, bạn trực tiếp phân bổ 18 điểm Spark Hồng cho từng nhân vật. Mỗi điểm Spark được gán vào một hạng mục sẽ mang lại 8% xác suất đột phá hạng mục đó lên <strong>Bậc S</strong> trong sự kiện Kế thừa vào đầu Năm 2 và Năm 3.</li>
          <li><strong>Bộ bài Hỗ trợ 40 lá:</strong> Thay vì chỉ mang 6 thẻ hỗ trợ cố định như bản gốc, bạn xây dựng một bộ bài 40 lá để rút dần qua từng lượt, tạo chiều sâu chiến thuật tương tự các trò chơi thẻ bài đối kháng.</li>
        </ul>
      </div>
    `
  },
  {
    id: 'training',
    menuTitle: '3. Giai Đoạn Huấn Luyện',
    heading: 'Giai Đoạn Huấn Luyện & Quản Lý Lượt (Năm 1 – Năm 3)',
    content: `
      <p>Mỗi năm bao gồm <strong>10 lượt huấn luyện</strong>. Cấp độ cơ sở huấn luyện sẽ tự động tăng dần theo từng năm để đẩy nhanh tốc độ tăng trưởng chỉ số: Năm 1 tương ứng <strong>Lv.1</strong>, Năm 2 tương ứng <strong>Lv.3</strong>, và Năm 3 đạt mức tối đa <strong>Lv.5</strong>.</p>

      <h4>Các Thao Tác Chính Trong Một Lượt</h4>
      <ul>
        <li><strong>Huấn luyện bằng Năng lượng (Training Energy):</strong> Mỗi lượt, hệ thống cấp cho bạn 1 viên Năng lượng thuộc một hệ chỉ số nhất định (Speed, Stamina, Power, Guts hoặc Wit). Kéo thả viên năng lượng này vào 1 trong 3 Uma để huấn luyện nhân vật đó.</li>
        <li><strong>Bỏ bài đổi hệ Năng lượng (Discard for Energy):</strong> Nếu hệ năng lượng của lượt hiện tại không phù hợp với kế hoạch, bạn có thể kéo 1 thẻ bài trên tay thả vào ô chuyển đổi ở góc dưới bên trái để đổi viên năng lượng sang đúng hệ của thẻ bài vừa bỏ.</li>
        <li><strong>Nghỉ ngơi chủ động (Active Rest):</strong> Thay vì huấn luyện, bạn có thể kéo biểu tượng Nghỉ ngơi vào 1 Uma. Thao tác này tiêu tốn viên năng lượng của lượt đó nhưng giúp nhân vật đưa tỷ lệ thất bại (Fail Rate) về 0%, tăng 1 bậc tâm trạng (Mood) và giúp bạn rút thêm 1 thẻ bài từ bộ bài.</li>
        <li><strong>Trại hè (Summer Camp):</strong> Diễn ra cố định vào <strong>Lượt 7 và Lượt 8 của Năm 2 và Năm 3</strong>. Trong thời gian Trại hè, hiệu quả tăng chỉ số khi huấn luyện được nhân thêm 1.5 lần và lệnh Nghỉ ngơi tăng liền 2 bậc Mood.</li>
      </ul>

      <div class="guide-diff-box">
        <div class="guide-diff-title">Điểm Tinh Chỉnh So Với Bản Gốc</div>
        <p>Mỗi lượt bạn chỉ có 1 hành động chính (Huấn luyện hoặc Nghỉ ngơi) áp dụng cho 1 nhân vật được chọn. Tuy nhiên, việc gắn thẻ Hỗ trợ, thu hồi thẻ và sử dụng Vật phẩm không tiêu tốn năng lượng, cho phép bạn thực hiện nhiều thao tác chuẩn bị trước khi kéo viên năng lượng vào nhân vật.</p>
      </div>
    `
  },
  {
    id: 'cards_skills',
    menuTitle: '4. Thẻ Hỗ Trợ & Kỹ Năng',
    heading: 'Cơ Chế Thẻ Hỗ Trợ, Thức Tỉnh Kỹ Năng & Thu Hồi Thẻ',
    content: `
      <p>Thẻ Hỗ trợ (Support Cards) đóng vai trò kép: vừa gia tăng lượng chỉ số nhận được khi huấn luyện, vừa là nguồn cung cấp kỹ năng trực tiếp cho Uma.</p>

      <h4>Trang Bị Thẻ & Cộng Hưởng (Rainbow Training)</h4>
      <ul>
        <li>Mỗi Uma có tối đa <strong>5 ô trang bị thẻ hỗ trợ</strong> (không được trang bị 2 thẻ trùng tên trên cùng một nhân vật).</li>
        <li>Khi kéo một thẻ từ tay thả vào Uma ở chế độ <strong>Trang bị (Equip)</strong>, nhân vật đó lập tức học được <strong>Kỹ năng Trắng (White Skill)</strong> của thẻ.</li>
        <li>Khi bạn huấn luyện một chỉ số trùng với hệ của các thẻ đang gắn trên nhân vật, hiệu ứng <strong>Cộng hưởng (Rainbow)</strong> sẽ kích hoạt, cộng thêm lượng lớn chỉ số tương ứng với số lượng thẻ cùng hệ đang trang bị.</li>
      </ul>

      <h4>Thức Tỉnh Kỹ Năng Vàng (Gold Awakening)</h4>
      <ul>
        <li>Khi một Uma đã có thẻ hỗ trợ đang gắn trên người, bạn có thể kéo một thẻ khác từ trên tay có <strong>cùng hệ chỉ số</strong> thả đè lên nhân vật đó để thực hiện <strong>Gold Awakening</strong>.</li>
        <li>Thẻ dùng làm nguyên liệu sẽ tiêu hao, và thẻ đang trang bị sẽ được nâng cấp vĩnh viễn từ Kỹ năng Trắng lên <strong>Kỹ năng Vàng (Gold Skill)</strong> tương ứng.</li>
        <li><strong>Vai trò đặc biệt của thẻ hệ Guts (Wildcard):</strong> Thẻ hỗ trợ hệ Guts có thể dùng làm nguyên liệu thức tỉnh Kỹ năng Vàng cho <strong>mọi hệ thẻ khác</strong> (Speed, Stamina, Power, Wit).</li>
      </ul>

      <h4>Thu Hồi Thẻ (Recall Card)</h4>
      <ul>
        <li>Đối với các thẻ đang trang bị nhưng <strong>chưa thức tỉnh Kỹ năng Vàng</strong>, bạn có thể nhấp chuột trái vào biểu tượng thẻ nhỏ trên nhân vật (hoặc kéo ngược về tay) để tháo thẻ ra.</li>
        <li>Khi thu hồi thẻ, Kỹ năng Trắng đi kèm thẻ đó cũng sẽ được gỡ bỏ, cho phép bạn chuyển thẻ sang nhân vật khác hoặc dùng thẻ đó làm nguyên liệu nâng cấp. Các thẻ đã thức tỉnh Kỹ năng Vàng sẽ khóa cố định vào nhân vật.</li>
      </ul>

      <div class="guide-diff-box">
        <div class="guide-diff-title">Điểm Tinh Chỉnh So Với Bản Gốc</div>
        <p>Trò chơi lược bỏ hoàn toàn hệ thống Điểm kỹ năng (Skill Points) và chờ dấu chấm than ngẫu nhiên (Skill Hints). Việc sở hữu Kỹ năng Trắng hay nâng cấp lên Kỹ năng Vàng hoàn toàn nằm trong quyền kiểm soát chiến thuật quản lý bài trên tay của người chơi.</p>
      </div>
    `
  },
  {
    id: 'events_items',
    menuTitle: '5. Sự Kiện & Vật Phẩm',
    heading: 'Sự Kiện Toàn Cục (Global Events) & Túi Vật Phẩm',
    content: `
      <p>Bên cạnh việc huấn luyện và đánh bài, người chơi còn nhận được sự hỗ trợ từ các nhân vật đồng hành học viện và hệ thống vật phẩm bổ trợ.</p>

      <h4>Sự Kiện Toàn Cục (Lượt 3, Lượt 6, Lượt 9)</h4>
      <ul>
        <li>Vào đúng các lượt 3, 6 và 9 của mỗi năm, một <strong>Sự kiện Hỗ trợ Toàn cục (Global Event)</strong> sẽ xuất hiện đồng thời cho cả hai người chơi.</li>
        <li>Mỗi sự kiện cung cấp 3 phương án lựa chọn với định hướng khác nhau: hồi phục thể lực và tâm trạng cho toàn đội, gia tăng mạnh chỉ số kèm rủi ro, hoặc rút thêm thẻ bài và nhận vật phẩm vào túi đồ.</li>
      </ul>

      <h4>Túi Vật Phẩm (Inventory)</h4>
      <ul>
        <li>Mỗi người chơi có tối đa <strong>3 ô chứa vật phẩm</strong>. Người chơi khởi đầu trận đấu với 1 vật phẩm và có thể nhận thêm thông qua các lựa chọn trong Sự kiện Toàn cục.</li>
        <li>Sử dụng vật phẩm <strong>không tiêu tốn lượt huấn luyện</strong>.</li>
        <li>Đối với vật phẩm tác động lên một nhân vật đơn lẻ (như nước uống xóa Fail Rate, bánh ngọt tăng Mood, sổ tay tăng chỉ số), bạn <strong>kéo thả trực tiếp vật phẩm vào Uma mục tiêu</strong>. Đối với vật phẩm tác động lên lượt huấn luyện chung (như Loa phóng thanh nhân 1.5 lần hiệu quả tập luyện), bạn chỉ cần nhấp chuột vào vật phẩm để kích hoạt.</li>
      </ul>
    `
  },
  {
    id: 'racing',
    menuTitle: '6. Cơ Chế Đường Đua',
    heading: 'Giai Đoạn Đua, Bậc Thích Nghi & Vận Hành Kỹ Năng',
    content: `
      <p>Khi bước vào giai đoạn đua cuối năm, 6 Uma của hai đội sẽ đứng trong cổng chờ xuất phát. Cuộc đua bắt đầu ngay khi cả hai người chơi nhấn xác nhận sẵn sàng hoặc tự động mở cổng sau 10 giây đếm ngược.</p>

      <h4>Tác Động Thực Tế Của Bậc Thích Nghi (S đến G)</h4>
      <ul>
        <li><strong>Thích nghi Cự ly (Sprint / Mile / Medium / Long):</strong> Tác động trực tiếp lên tốc độ di chuyển và tốc độ bứt phá cuối chặng. Đưa nhân vật có bậc thích nghi thấp (từ D đến G) vào cự ly không phù hợp sẽ làm suy giảm nghiêm trọng tốc độ nền.</li>
        <li><strong>Thích nghi Mặt sân (Turf / Dirt):</strong> Tác động trực tiếp lên khả năng tăng tốc (Power) và mức tiêu hao thể lực. Chạy trên mặt sân không phù hợp khiến nhân vật tăng tốc chậm và tiêu tốn thể lực nhanh hơn bình thường.</li>
        <li><strong>Thích nghi Chiến thuật (Front / Pace / Late / End):</strong> Tác động trực tiếp lên khả năng đọc trận đấu (Wit) và <strong>tỷ lệ kích hoạt kỹ năng</strong>. Ngoài ra, bạn có thể nhấp chuột phải vào Uma của mình trên bàn đấu để chuyển đổi chiến thuật chạy bất cứ lúc nào trước khi bước vào kỳ đua.</li>
      </ul>

      <h4>Quy Tắc Kích Hoạt Kỹ Năng Trên Đường Đua</h4>
      <ul>
        <li><strong>Ràng buộc đúng Chiến thuật và Cự ly:</strong> Các kỹ năng chuyên biệt của từng lối chạy (ví dụ kỹ năng dành riêng cho Front Runner hoặc Late Surger) và từng cự ly sẽ <strong>chỉ kích hoạt khi nhân vật đang thi đấu đúng chiến thuật và cự ly đó</strong>.</li>
        <li><strong>Nhóm Kỹ năng Xanh lá (Passive):</strong> Kiểm tra điều kiện tương thích (mùa giải, hướng rẽ trái/phải, cự ly chuẩn/phi chuẩn, tình trạng mặt sân) ngay khi mở cổng xuất phát. Nếu vượt qua kiểm định Wit, kỹ năng sẽ cộng thẳng chỉ số cố định tồn tại xuyên suốt cả chặng đua.</li>
        <li><strong>Nhóm Kỹ năng Chủ động:</strong> Bao gồm kỹ năng phản xạ cổng (ngăn ngừa xuất phát chậm), kỹ năng hồi phục thể lực giữa chặng, kỹ năng gia tốc và kỹ năng nâng trần tốc độ ở giai đoạn nước rút.</li>
      </ul>
    `
  }
];

function setLobbyDiscordVisible(isVisible) {
  const badge = document.getElementById('lobby-discord-contact');
  if (badge) {
    badge.style.display = isVisible ? 'flex' : 'none';
  }
}

function initLobbyGuideSystem() {
  // 1. Chèn CSS cho Modal Hướng dẫn và Nút ở Sảnh chính
  if (!document.getElementById('twinkle-guide-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'twinkle-guide-styles';
    styleEl.innerHTML = `
      .btn-open-guide-lobby {
        width: 100%;
        margin-top: 12px;
        padding: 10px 16px;
        background: #1e293b;
        border: 1px solid #38bdf8;
        color: #e0f2fe;
        border-radius: 8px;
        font-weight: 700;
        font-size: 13px;
        letter-spacing: 0.4px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .btn-open-guide-lobby:hover {
        background: #0284c7;
        color: #ffffff;
        box-shadow: 0 4px 14px rgba(56, 189, 248, 0.35);
      }
      #guide-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(2, 6, 23, 0.85);
        backdrop-filter: blur(5px);
        z-index: 9500;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }
      .guide-modal-container {
        width: 920px;
        max-width: 96vw;
        height: 600px;
        max-height: 88vh;
        background: #0f172a;
        border: 1px solid #334155;
        border-radius: 12px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.85);
      }
      .guide-modal-header {
        padding: 14px 20px;
        background: #090d16;
        border-bottom: 1px solid #1e293b;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .guide-modal-header h3 {
        margin: 0;
        font-size: 15px;
        font-weight: 800;
        color: #f8fafc;
        letter-spacing: 0.5px;
        text-transform: uppercase;
      }
      .guide-close-btn {
        width: auto;
        margin: 0;
        padding: 6px 14px;
        background: #1e293b;
        border: 1px solid #475569;
        color: #cbd5e1;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }
      .guide-close-btn:hover {
        background: #ef4444;
        border-color: #ef4444;
        color: #ffffff;
      }
      .guide-modal-body {
        flex: 1;
        display: grid;
        grid-template-columns: 240px 1fr;
        min-height: 0;
      }
      .guide-sidebar {
        background: #0b1120;
        border-right: 1px solid #1e293b;
        padding: 12px 10px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        overflow-y: auto;
      }
      .guide-nav-item {
        width: 100%;
        text-align: left;
        margin: 0;
        padding: 10px 12px;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 7px;
        color: #94a3b8;
        font-size: 12.5px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .guide-nav-item:hover {
        background: #1e293b;
        color: #f1f5f9;
      }
      .guide-nav-item.active {
        background: rgba(14, 165, 233, 0.15);
        border-color: #38bdf8;
        color: #38bdf8;
        font-weight: 700;
      }
      .guide-content-pane {
        padding: 22px 28px;
        overflow-y: auto;
        color: #cbd5e1;
        font-size: 13.5px;
        line-height: 1.68;
      }
      .guide-content-pane h2 {
        margin: 0 0 14px 0;
        font-size: 19px;
        color: #f8fafc;
        border-bottom: 1px solid #1e293b;
        padding-bottom: 10px;
      }
      .guide-content-pane h4 {
        margin: 18px 0 8px 0;
        font-size: 14.5px;
        color: #facc15;
      }
      .guide-content-pane p {
        margin: 0 0 12px 0;
      }
      .guide-content-pane ul {
        margin: 0 0 14px 0;
        padding-left: 20px;
      }
      .guide-content-pane li {
        margin-bottom: 7px;
      }
      .guide-content-pane strong {
        color: #f1f5f9;
      }
      .guide-diff-box {
        margin-top: 18px;
        padding: 14px 16px;
        background: rgba(15, 23, 42, 0.9);
        border-left: 3px solid #38bdf8;
        border-top: 1px solid #1e293b;
        border-right: 1px solid #1e293b;
        border-bottom: 1px solid #1e293b;
        border-radius: 6px;
      }
      .guide-diff-title {
        font-size: 12px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: #38bdf8;
        margin-bottom: 6px;
      }
    `;
    document.head.appendChild(styleEl);
  }

  // 2. Chèn Nút Hướng Dẫn vào Sảnh Chính (#lobby-screen)
  const lobbyScreen = document.getElementById('lobby-screen');
  if (lobbyScreen && !document.getElementById('btn-open-game-guide')) {
    const lobbyCard = lobbyScreen.querySelector('.lobby-box, .card, div') || lobbyScreen;
    const guideBtn = document.createElement('button');
    guideBtn.id = 'btn-open-game-guide';
    guideBtn.className = 'btn-open-guide-lobby';
    guideBtn.innerText = 'Cẩm Nang Hướng Dẫn & Luật Đấu';
    guideBtn.onclick = () => openGameGuideModal('overview');
    lobbyCard.appendChild(guideBtn);
  }

  // 3. Khởi tạo Modal Hướng Dẫn có Menu bên trái
  if (!document.getElementById('guide-modal-overlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'guide-modal-overlay';
    overlay.onclick = (e) => {
      if (e.target === overlay) overlay.style.display = 'none';
    };

    overlay.innerHTML = `
      <div class="guide-modal-container" onclick="event.stopPropagation()">
        <div class="guide-modal-header">
          <h3>Cẩm Nang Hướng Dẫn — Twinkle Tactics: Card Derby</h3>
          <button class="guide-close-btn" id="btn-close-game-guide">Đóng Bảng</button>
        </div>
        <div class="guide-modal-body">
          <div class="guide-sidebar" id="guide-sidebar-menu"></div>
          <div class="guide-content-pane" id="guide-content-area"></div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('btn-close-game-guide').onclick = () => {
      overlay.style.display = 'none';
    };
  }

  // 4. Chèn Huy hiệu Liên hệ Discord (cafe_1710) trực tiếp vào document.body ở góc dưới bên trái
  if (!document.getElementById('lobby-discord-contact')) {
    const discordBadge = document.createElement('div');
    discordBadge.id = 'lobby-discord-contact';
    discordBadge.title = 'Nhấp để sao chép ID Discord: cafe_1710';
    discordBadge.style.cssText = `
      position: fixed;
      bottom: 14px;
      left: 14px;
      z-index: 9999;
      background: rgba(15, 23, 42, 0.94);
      border: 1.5px solid #5865F2;
      border-radius: 10px;
      padding: 8px 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.7);
      color: #f8fafc;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      backdrop-filter: blur(6px);
    `;

    discordBadge.onmouseenter = () => {
      discordBadge.style.background = '#5865F2';
      discordBadge.style.boxShadow = '0 6px 20px rgba(88, 101, 242, 0.5)';
    };
    discordBadge.onmouseleave = () => {
      discordBadge.style.background = 'rgba(15, 23, 42, 0.94)';
      discordBadge.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.7)';
    };

    discordBadge.onclick = () => {
      if (navigator.clipboard) {
        navigator.clipboard.writeText('cafe_1710').catch(() => {});
      }
      showToast('Đã sao chép ID Discord liên hệ: cafe_1710');
    };

    discordBadge.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="#ffffff" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
      </svg>
      <div style="display:flex; flex-direction:column; line-height:1.25;">
        <span style="font-size:10px; color:#94a3b8; font-weight:600;">LIÊN HỆ / GÓP Ý DISCORD</span>
        <strong style="font-size:13px; color:#ffffff; letter-spacing:0.3px;">cafe_1710</strong>
      </div>
    `;

    document.body.appendChild(discordBadge);
  }
}

function openGameGuideModal(sectionId = 'overview') {
  initLobbyGuideSystem();
  const overlay = document.getElementById('guide-modal-overlay');
  const sidebarEl = document.getElementById('guide-sidebar-menu');
  const contentEl = document.getElementById('guide-content-area');
  if (!overlay || !sidebarEl || !contentEl) return;

  const targetSection = GAME_GUIDE_SECTIONS.find(s => s.id === sectionId) || GAME_GUIDE_SECTIONS[0];

  sidebarEl.innerHTML = GAME_GUIDE_SECTIONS.map(sec => `
    <button class="guide-nav-item ${sec.id === targetSection.id ? 'active' : ''}" onclick="openGameGuideModal('${sec.id}')">
      ${sec.menuTitle}
    </button>
  `).join('');

  contentEl.innerHTML = `
    <h2>${targetSection.heading}</h2>
    ${targetSection.content}
  `;
  contentEl.scrollTop = 0;
  overlay.style.display = 'flex';
}

function playTurnBannerAnimation(title, subtitle) {
  const strip = document.getElementById('turn-banner-strip');
  if (!strip) return;
  document.getElementById('turn-banner-title').innerText = title;
  document.getElementById('turn-banner-sub').innerText = subtitle || '';
  strip.classList.remove('animate-banner');
  void strip.offsetWidth;
  strip.classList.add('animate-banner');
}

function showToast(msg, isError = false) {
  const el = document.getElementById('action-toast');
  if (!el) return;
  el.innerText = msg;
  el.style.borderColor = isError ? '#f43f5e' : '#facc15';
  el.style.color = isError ? '#fda4af' : '#fef08a';
  el.style.display = 'block';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.display = 'none'; }, 3400);
}

socket.on('action_error', (msg) => showToast('[ERROR] ' + msg, true));

function openCardZoom(card) {
  document.getElementById('zoom-img').src = card.icon;
  document.getElementById('zoom-title').innerText = card.name;
  document.getElementById('zoom-type').innerHTML = `${renderStatIconHTML(card.type, 22)} <span>SSR ${card.type} Support</span>`;
  document.getElementById('zoom-white').innerText = card.whiteSkill;
  document.getElementById('zoom-gold').innerText = card.goldSkill;
  document.getElementById('zoom-desc').innerText = card.desc || 'Kéo thả vào Uma để Trang bị hoặc thực hiện Gold Awakening.';
  document.getElementById('card-zoom-modal').style.display = 'flex';
}

// =========================================================================
// HIỆU ỨNG LẬT MỞ TỪNG MAP KỊCH TÍNH (1 -> 7) KÈM MÙA GIẢI (SEASON)
// =========================================================================
function startDramaticMapReveal(maps) {
  revealTimers.forEach(t => clearTimeout(t));
  revealTimers = [];

  const overlay = document.getElementById('map-reveal-overlay');
  const container = document.getElementById('reveal-cards-container');
  const leftPreGameList = document.getElementById('pregame-map-list');

  container.innerHTML = '';
  leftPreGameList.innerHTML = '<div style="font-size:10.5px; color:#38bdf8; text-align:center;">Click / Chuột phải vào Map để mở Map Helper</div>';
  overlay.style.display = 'flex';

  maps.forEach((m, idx) => {
    const card = document.createElement('div');
    card.id = `reveal-card-${idx}`;
    card.className = 'reveal-map-card' + (m.slot === 'Tie break' ? ' tiebreak-card' : '');
    const surfColor = m.surface === 'Turf' ? '#4ade80' : '#fb923c';
    const seasonLabel = m.season || 'Spring';

    card.innerHTML = `
      <div style="font-size:11px; font-weight:bold; color:${m.slot === 'Tie break' ? '#f43f5e' : '#38bdf8'};">
        ${m.slot.toUpperCase()} • ${seasonLabel.toUpperCase()}
      </div>
      <div>
        <div style="font-size:15px; font-weight:bold; color:#fff; margin:6px 0;">${m.name}</div>
        <div style="font-size:10.5px; color:#94a3b8;">${m.famousRace || ''}</div>
      </div>
      <div>
        <span style="display:inline-block; padding:2px 8px; border-radius:4px; background:#0f172a; color:${surfColor}; font-size:11px; font-weight:bold;">
          ${m.surface} • ${m.distanceType}
        </span>
        <div style="font-size:11px; color:#facc15; margin-top:6px;">Mùa: ${seasonLabel} | Sân: ${m.condition}</div>
      </div>
    `;
    container.appendChild(card);
  });

  maps.forEach((m, idx) => {
    const t = setTimeout(() => {
      const seasonLabel = m.season || 'Spring';
      document.getElementById('reveal-current-slot').innerText = `CHẶNG ${idx + 1} / 7 — ${m.slot.toUpperCase()}`;
      document.getElementById('reveal-current-name').innerText = `${m.name} (${m.famousRace || 'G1 Track'})`;
      document.getElementById('reveal-current-meta').innerText =
        `${m.surface} | ${m.distanceType} (${m.length}m) | Mùa: ${seasonLabel} | Sân: ${m.condition}`;

      const cardEl = document.getElementById(`reveal-card-${idx}`);
      if (cardEl) cardEl.classList.add('revealed');
      appendSingleMapToPanel('pregame-map-list', m);
    }, idx * 700 + 200);
    revealTimers.push(t);
  });

  const endTimer = setTimeout(() => finishMapReveal(maps), maps.length * 700 + 1400);
  revealTimers.push(endTimer);

  document.getElementById('btn-skip-reveal').onclick = () => finishMapReveal(maps);
}

function finishMapReveal(maps) {
  revealTimers.forEach(t => clearTimeout(t));
  revealTimers = [];
  document.getElementById('map-reveal-overlay').style.display = 'none';
  renderMapList('pregame-map-list', maps);
}

function appendSingleMapToPanel(containerId, m) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const div = document.createElement('div');
  div.className = 'map-item slam-anim' + (m.slot === 'Tie break' ? ' tiebreak' : '');
  div.title = 'Click hoặc Chuột phải để mở Map Helper';
  div.onclick = () => openMapBlueprintModal(m);
  div.oncontextmenu = (e) => {
    e.preventDefault();
    openMapBlueprintModal(m);
  };

  const seasonLabel = m.season || 'Spring';
  const resultHtml = m.raceResult
    ? `<div style="font-size:10px; color:#4ade80; margin-top:3px; font-weight:bold; border-top:1px solid #1e293b; padding-top:2px;">
         #1: ${m.raceResult.winnerName} (${m.raceResult.ownerName})
       </div>`
    : '';

  div.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <strong>${m.slot}: ${m.name}</strong>
      <span style="font-size:9.5px; background:#1e293b; color:#38bdf8; padding:1px 5px; border-radius:4px;">${seasonLabel}</span>
    </div>
    <div style="font-size:10px; color:#cbd5e1; margin:1px 0;">${m.famousRace || ''}</div>
    <span style="color:#94a3b8;">${m.surface} | ${m.distanceType} (${m.length}m)</span> | 
    <span style="color:#facc15;">Sân: ${m.condition}</span>
    ${resultHtml}
  `;
  el.appendChild(div);
}

function renderMapList(containerId, maps) {
  currentMapsList = maps || [];
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '<div style="font-size:10.5px; color:#38bdf8; text-align:center; margin-bottom:2px;">Chuột phải / Click vào Map để mở Map Helper</div>';
  maps.forEach(m => appendSingleMapToPanel(containerId, m));
}

// =========================================================================
// ĐIỀU HƯỚNG TỪNG BƯỚC PRE-GAME (STEP 1 -> STEP 2 -> STEP 3)
// =========================================================================
function goToPreGameStep(stepNum) {
  if (stepNum >= 2 && selectedUmaIds.length !== 3) {
    showToast('Hãy chọn đủ 3 Uma Chủ Lực ở Bước 1 trước khi tiếp tục!', true);
    return;
  }
  currentPreGameStep = stepNum;

  [1, 2, 3].forEach(s => {
    const panel = document.getElementById(`pregame-step-${s}`);
    const tab = document.getElementById(`step-tab-${s}`);
    if (panel) panel.style.display = s === stepNum ? 'flex' : 'none';
    if (tab) {
      tab.classList.remove('active', 'completed');
      if (s === stepNum) tab.classList.add('active');
      else if (s < stepNum) tab.classList.add('completed');
    }
  });

  renderPreGameUI();
  renderDeckBuilderUI();
}

function computeRankFromSparks(baseRank, sparkCount) {
  const baseIdx = RANKS.indexOf(baseRank);
  let stepsGained = 0;
  if (sparkCount >= 10) stepsGained = 4;
  else if (sparkCount >= 7) stepsGained = 3;
  else if (sparkCount >= 4) stepsGained = 2;
  else if (sparkCount >= 1) stepsGained = 1;

  const maxInitialIdx = RANKS.indexOf('A');
  return RANKS[Math.min(maxInitialIdx, baseIdx + stepsGained)];
}

function getUsedSparks(umaId) {
  const map = allocatedSparks[umaId] || {};
  return Object.values(map).reduce((sum, val) => sum + (val || 0), 0);
}

function adjustSparkCount(umaId, aptKey, delta) {
  if (!allocatedSparks[umaId]) allocatedSparks[umaId] = {};
  const current = allocatedSparks[umaId][aptKey] || 0;
  const next = current + delta;
  if (next < 0 || next > 18) return;
  if (getUsedSparks(umaId) + delta > 18) return;

  allocatedSparks[umaId][aptKey] = next;
  renderPreGameUI();
}

function setUmaFilter(filterKey) {
  currentUmaFilter = filterKey;
  const btns = document.querySelectorAll('#uma-filter-bar .filter-btn');
  btns.forEach(b => {
    b.classList.toggle('active', b.innerText.includes(filterKey) || (filterKey === 'ALL' && b.innerText === 'Tất Cả'));
  });
  renderPreGameUI();
}

function setCardTypeFilter(typeKey) {
  currentCardTypeFilter = typeKey;
  renderDeckBuilderUI();
}

function applyDeckPreset(presetType) {
  if (presetType === 'balanced40') {
    const picked = [];
    ['Speed', 'Stamina', 'Power', 'Guts', 'Wit'].forEach(t => {
      supportPool.filter(c => c.type === t).slice(0, 8).forEach(c => picked.push(c.uid));
    });
    selectedDeckUids = picked;
    showToast('Đã chọn nhanh 40 thẻ SSR cân bằng (8 lá mỗi hệ)!');
  } else if (presetType === 'clear') {
    selectedDeckUids = [];
  }
  renderDeckBuilderUI();
}

function renderDeckBuilderUI() {
  document.getElementById('deck-selected-count').innerText = selectedDeckUids.length;
  const counts = { Speed: 0, Stamina: 0, Power: 0, Guts: 0, Wit: 0 };
  selectedDeckUids.forEach(uid => {
    const c = supportPool.find(x => x.uid === uid);
    if (c && counts[c.type] !== undefined) counts[c.type]++;
  });

  document.getElementById('deck-type-breakdown').innerHTML = `
    Kho thẻ: <b>${supportPool.length} SSR</b> | Đã chọn: 
    Speed: <b>${counts.Speed}/12</b> | Stamina: <b>${counts.Stamina}/12</b> | 
    Power: <b>${counts.Power}/12</b> | Guts: <b>${counts.Guts}/12</b> | Wit: <b>${counts.Wit}/12</b>
  `;

  const filterBar = document.getElementById('card-filter-bar');
  const types = ['ALL', 'Speed', 'Stamina', 'Power', 'Guts', 'Wit'];
  filterBar.innerHTML = types.map(t => {
    const isActive = currentCardTypeFilter === t ? 'active' : '';
    if (t === 'ALL') {
      return `<button class="filter-btn ${isActive}" onclick="setCardTypeFilter('ALL')">Tất Cả (${supportPool.length})</button>`;
    }
    const totalOfType = supportPool.filter(c => c.type === t).length;
    return `<button class="filter-btn ${isActive}" onclick="setCardTypeFilter('${t}')">
      ${renderStatIconHTML(t, 16)} <span>${t} (${counts[t]}/12 — ${totalOfType} SSR)</span>
    </button>`;
  }).join('');

  const container = document.getElementById('deck-pool-container');
  container.innerHTML = '';
  supportPool
    .filter(c => currentCardTypeFilter === 'ALL' || c.type === currentCardTypeFilter)
    .forEach(card => {
      const isSelected = selectedDeckUids.includes(card.uid);
      const div = document.createElement('div');
      div.className = 'deck-pool-card' + (isSelected ? ' in-deck' : '');
      div.onclick = () => {
        if (isSelected) {
          selectedDeckUids = selectedDeckUids.filter(id => id !== card.uid);
        } else {
          if (selectedDeckUids.length >= 40) return showToast('Deck đã đủ 40 lá!', true);
          if (counts[card.type] >= 12) return showToast(`Hệ ${card.type} chỉ được tối đa 12 lá!`, true);
          selectedDeckUids.push(card.uid);
        }
        renderDeckBuilderUI();
      };
      div.oncontextmenu = (e) => {
        e.preventDefault();
        openCardZoom(card);
      };
      div.innerHTML = `
        <div class="card-thumb-wrap">
          <img class="support-card-icon" src="${card.icon}" onerror="this.src='${fallbackAvatar(card.type, '#475569')}'">
          ${renderStatIconHTML(card.type, 15, 'card-type-corner')}
        </div>
        <div style="min-width:0;">
          <div style="font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${card.name}</div>
          <div style="color:#facc15; font-size:10px;">[GOLD] ${card.goldSkill}</div>
          <div style="color:${isSelected ? '#4ade80' : '#94a3b8'}; font-size:10px;">${isSelected ? 'Đã chọn trong Deck' : 'Click để thêm'}</div>
        </div>
      `;
      container.appendChild(div);
    });
}

// =========================================================================
// XỬ LÝ KÉO THẢ THẺ BÀI VÀO UMA (TRANG BỊ vs GOLD AWAKENING)
// =========================================================================
function handleCardDropOnUma(cardUid, umaIndex) {
  if (!latestGameState) return;
  const card = latestGameState.myHand.find(c => c.uid === cardUid);
  const uma = latestGameState.myUmas[umaIndex];
  if (!card || !uma) return;

  const eligibleTargets = (uma.equippedCards || []).filter(
    eq => !eq.isGoldAwakened && (eq.type === card.type || card.type === 'Guts')
  );

  if (eligibleTargets.length === 0) {
    socket.emit('play_card_on_uma', {
      roomCode: currentRoomCode,
      sessionToken,
      cardUid: card.uid,
      umaIndex,
      mode: 'equip'
    });
    return;
  }
  openCardActionModal(card, uma, umaIndex, eligibleTargets);
}

function openCardActionModal(card, uma, umaIndex, eligibleTargets) {
  const modal = document.getElementById('card-choice-modal');
  document.getElementById('choice-modal-header').innerText = `Sử dụng Support Card lên ${uma.name}`;

  document.getElementById('choice-dragged-card-preview').innerHTML = `
    <div class="card-thumb-wrap">
      <img class="support-card-icon" src="${card.icon}" onerror="this.src='${fallbackAvatar(card.type, '#475569')}'">
      ${renderStatIconHTML(card.type, 16, 'card-type-corner')}
    </div>
    <div style="font-size:12px;">
      <strong style="color:#facc15; font-size:14px;">${card.name}</strong>
      <span style="color:#94a3b8;">(${card.type === 'Guts' ? 'Guts - Wildcard' : card.type})</span><br>
      <span class="skill-tag-label tag-white">WHITE</span><b>${card.whiteSkill}</b> | 
      <span class="skill-tag-label tag-gold">GOLD</span><b style="color:#facc15;">${card.goldSkill}</b>
    </div>
  `;

  const eqCards = uma.equippedCards || [];
  const isFull = eqCards.length >= 5;
  const isDuplicate = eqCards.some(eq => eq.baseId === card.baseId);
  const btnEquip = document.getElementById('btn-confirm-equip');
  const equipDesc = document.getElementById('choice-equip-desc');

  if (isFull) {
    equipDesc.innerHTML = `<span style="color:#f43f5e;">${uma.name} đã đầy 5/5 ô trang bị thẻ.</span>`;
    btnEquip.disabled = true;
  } else if (isDuplicate) {
    equipDesc.innerHTML = `<span style="color:#f43f5e;">${uma.name} đã trang bị thẻ [${card.name}] rồi.</span>`;
    btnEquip.disabled = true;
  } else {
    equipDesc.innerHTML = `Gắn vào ô Hỗ trợ (${eqCards.length + 1}/5) để nhận kỹ năng <b>${card.whiteSkill}</b> và +1 Rainbow ${renderStatIconHTML(card.type, 14)}.`;
    btnEquip.disabled = false;
    btnEquip.onclick = () => {
      modal.style.display = 'none';
      socket.emit('play_card_on_uma', {
        roomCode: currentRoomCode,
        sessionToken,
        cardUid: card.uid,
        umaIndex,
        mode: 'equip'
      });
    };
  }

  const listEl = document.getElementById('choice-eligible-list');
  listEl.innerHTML = '';
  eligibleTargets.forEach(targetCard => {
    const item = document.createElement('div');
    item.className = 'eligible-target-item';
    item.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <div class="card-thumb-wrap">
          <img class="support-card-icon" src="${targetCard.icon}" onerror="this.src='${fallbackAvatar(targetCard.type, '#475569')}'">
          ${renderStatIconHTML(targetCard.type, 16, 'card-type-corner')}
        </div>
        <div style="font-size:12px;">
          <strong>${targetCard.name}</strong><br>
          <span style="color:#94a3b8; text-decoration:line-through;">${targetCard.whiteSkill}</span>
          <span style="color:#facc15; font-weight:bold;"> -> [GOLD] ${targetCard.goldSkill}</span>
        </div>
      </div>
      <button style="width:auto; padding:7px 14px; background:linear-gradient(90deg,#ca8a04,#eab308); color:#000; margin:0; font-size:12px;">
        Gold Awakening
      </button>
    `;
    item.onclick = () => {
      modal.style.display = 'none';
      socket.emit('play_card_on_uma', {
        roomCode: currentRoomCode,
        sessionToken,
        cardUid: card.uid,
        umaIndex,
        mode: 'awaken',
        targetEquippedUid: targetCard.uid
      });
    };
    listEl.appendChild(item);
  });

  modal.style.display = 'flex';
}

// =========================================================================
// KẾT NỐI PHÒNG & KHỞI TẠO NÚT HƯỚNG DẪN + DISCORD TẠI SẢNH CHÍNH
// =========================================================================
initLobbyGuideSystem();

window.onload = () => {
  initLobbyGuideSystem();
  const savedRoom = localStorage.getItem('twinkle_current_room');
  if (savedRoom && document.getElementById('join-code-input')) {
    document.getElementById('join-code-input').value = savedRoom;
  }
};

document.getElementById('btn-create').onclick = () => {
  socket.emit('create_room', { playerName: document.getElementById('player-name').value, sessionToken });
};

socket.on('room_created', ({ roomCode }) => {
  currentRoomCode = roomCode;
  localStorage.setItem('twinkle_current_room', roomCode);
  document.getElementById('created-code-area').style.display = 'block';
  document.getElementById('display-room-code').innerText = roomCode;
});

document.getElementById('btn-join').onclick = () => {
  const code = document.getElementById('join-code-input').value.trim().toUpperCase();
  currentRoomCode = code;
  localStorage.setItem('twinkle_current_room', code);
  socket.emit('join_room', { roomCode: code, playerName: document.getElementById('player-name').value, sessionToken });
};

socket.on('error_msg', msg => document.getElementById('lobby-error').innerText = msg);

socket.on('enter_pregame', (data) => {
  currentRoomCode = data.roomCode;
  umaPool = data.umaPool || [];
  supportPool = data.supportPool || [];
  currentMapsList = data.maps || [];

  selectedUmaIds = [];
  selectedDeckUids = [];
  umaPool.forEach(u => { allocatedSparks[u.id] = {}; });

  const lockBtn = document.getElementById('btn-lock-pregame');
  if (lockBtn) {
    lockBtn.disabled = false;
    lockBtn.innerText = 'Chốt Đội Hình & Bắt Đầu Trận Đấu';
  }

  const guideModal = document.getElementById('guide-modal-overlay');
  if (guideModal) guideModal.style.display = 'none';
  setLobbyDiscordVisible(false);

  document.getElementById('lobby-screen').style.display = 'none';
  document.getElementById('pregame-screen').style.display = 'grid';
  document.getElementById('uma-total-count').innerText = umaPool.length;

  goToPreGameStep(1);

  if (!data.isReconnect) {
    startDramaticMapReveal(data.maps);
  } else {
    renderMapList('pregame-map-list', data.maps);
  }
});

function renderPreGameUI() {
  document.getElementById('selected-count').innerText = selectedUmaIds.length;
  const searchVal = (document.getElementById('uma-search-input')?.value || '').trim().toLowerCase();
  const poolEl = document.getElementById('uma-pool-container');
  poolEl.innerHTML = '';

  const filteredUmas = umaPool.filter(u => {
    if (searchVal && !u.name.toLowerCase().includes(searchVal)) return false;
    if (currentUmaFilter === 'ALL') return true;
    const rank = u.aptitudes[currentUmaFilter];
    return rank === 'A' || rank === 'B';
  });

  if (filteredUmas.length === 0) {
    poolEl.innerHTML = `<div style="grid-column: 1 / 5; padding: 20px; text-align: center; color: #94a3b8;">
      Không tìm thấy Uma nào khớp với "${searchVal}".
    </div>`;
  } else {
    filteredUmas.forEach(u => {
      const isSel = selectedUmaIds.includes(u.id);
      const item = document.createElement('div');
      item.className = 'roster-item' + (isSel ? ' selected' : '');
      item.title = 'Click trái để Chọn | Chuột phải để xem Full Thông tin & Pot Skills';

      item.onclick = () => {
        if (isSel) selectedUmaIds = selectedUmaIds.filter(id => id !== u.id);
        else if (selectedUmaIds.length < 3) selectedUmaIds.push(u.id);
        else showToast('Bạn đã chọn đủ 3 Uma!', true);
        renderPreGameUI();
      };

      item.oncontextmenu = (e) => {
        e.preventDefault();
        if (typeof openUmaDetailModal === 'function') {
          openUmaDetailModal(u, null, false);
        }
      };

      const goldPots = (u.potSkills || []).filter(p => p.isGold).map(p => p.name).join(' • ');
      const aptBar = typeof renderCompactAptitudesBar === 'function'
        ? renderCompactAptitudesBar(u.aptitudes)
        : `Turf ${u.aptitudes.Turf} | Dirt ${u.aptitudes.Dirt}`;

      item.innerHTML = `
        <img class="uma-avatar" src="${u.icon}" onerror="if(this.src!=='${u.fallbackIcon||''}' && '${u.fallbackIcon||''}'){this.src='${u.fallbackIcon}';}else{this.src='${fallbackAvatar(u.name, u.color)}';}">
        <div style="min-width:0;">
          <div style="font-weight:bold; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${u.name}</div>
          <div style="font-size:9.5px; color:#facc15; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="Kỹ năng Vàng có sẵn trong Pot">[POT★] ${goldPots || 'Standard Pot'}</div>
          <div style="font-size:9px; color:#cbd5e1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${aptBar}</div>
        </div>
      `;
      poolEl.appendChild(item);
    });
  }

  const sparkEl = document.getElementById('spark-editor-container');
  sparkEl.innerHTML = '';
  selectedUmaIds.forEach((id, idx) => {
    const u = umaPool.find(x => x.id === id);
    if (!u) return;
    const used = getUsedSparks(u.id);
    const card = document.createElement('div');
    card.className = 'spark-card';
    let aptRowsHTML = '';

    Object.entries(u.aptitudes).forEach(([aptKey, baseRank]) => {
      const sparks = (allocatedSparks[u.id] && allocatedSparks[u.id][aptKey]) || 0;
      const finalRank = computeRankFromSparks(baseRank, sparks);
      const inheritChance = sparks * 8;

      aptRowsHTML += `
        <div class="apt-row">
          <span><b>${aptKey}</b> <span style="color:#94a3b8; font-size:10px;">(Gốc ${baseRank})</span></span>
          <div style="display:flex; align-items:center; gap:4px;">
            <span style="font-size:10px; color:#f472b6;">${sparks} Spark (${inheritChance}% nổ)</span>
            <span class="rank-badge rank-${finalRank}">${finalRank}</span>
            <button class="apt-btn" onclick="adjustSparkCount('${u.id}','${aptKey}',-1)">-</button>
            <button class="apt-btn" onclick="adjustSparkCount('${u.id}','${aptKey}',1)">+</button>
          </div>
        </div>
      `;
    });

    card.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px; cursor:context-menu;" title="Chuột phải để xem chi tiết Uma" oncontextmenu="event.preventDefault(); if(typeof openUmaDetailModal==='function') openUmaDetailModal(umaPool.find(x=>x.id==='${u.id}'), null, false);">
        <img class="uma-avatar" style="width:40px; height:40px;" src="${u.icon}" onerror="if(this.src!=='${u.fallbackIcon||''}' && '${u.fallbackIcon||''}'){this.src='${u.fallbackIcon}';}else{this.src='${fallbackAvatar(u.name, u.color)}';}">
        <div>
          <strong>Uma ${idx + 1}: ${u.name}</strong><br>
          <span style="font-size:11px; color:#f472b6;">Spark Hồng còn lại: <strong>${18 - used}/18</strong></span>
        </div>
      </div>
      ${aptRowsHTML}
    `;
    sparkEl.appendChild(card);
  });
}

document.getElementById('btn-lock-pregame').onclick = () => {
  if (selectedUmaIds.length !== 3) return showToast('Hãy chọn đủ 3 Uma!', true);
  if (selectedDeckUids.length !== 40) return showToast('Bộ bài (Deck) phải có đủ 40 lá (Hiện tại: ' + selectedDeckUids.length + '/40)!', true);

  const chosenUmas = selectedUmaIds.map(id => {
    const u = JSON.parse(JSON.stringify(umaPool.find(x => x.id === id)));
    u.pinkSparks = allocatedSparks[id] || {};
    Object.keys(u.aptitudes).forEach(k => {
      const sp = u.pinkSparks[k] || 0;
      u.aptitudes[k] = computeRankFromSparks(u.aptitudes[k], sp);
    });
    return u;
  });
  document.getElementById('btn-lock-pregame').innerText = 'Đang chờ đối thủ...';
  document.getElementById('btn-lock-pregame').disabled = true;
  socket.emit('submit_pregame', {
    roomCode: currentRoomCode,
    sessionToken,
    chosenUmas,
    chosenDeckUids: selectedDeckUids
  });
};

// =========================================================================
// KÉO THẢ NĂNG LƯỢNG, ACTIVE REST & Ô BỎ BÀI ĐỔI NĂNG LƯỢNG
// =========================================================================
const energyOrbEl = document.getElementById('ui-current-energy');
energyOrbEl.ondragstart = (e) => {
  if (energyOrbEl.classList.contains('used')) {
    e.preventDefault();
    return;
  }
  draggedPayload = { kind: 'energy' };
  e.dataTransfer.setData('text/plain', 'energy');
};

const restTokenEl = document.getElementById('draggable-rest-token');
restTokenEl.ondragstart = (e) => {
  if (energyOrbEl.classList.contains('used')) {
    showToast('[ERROR] Bạn đã dùng Năng lượng lượt này rồi.', true);
    e.preventDefault();
    return;
  }
  draggedPayload = { kind: 'rest' };
  e.dataTransfer.setData('text/plain', 'rest');
};

const discardZone = document.getElementById('bottom-left-discard-zone');
discardZone.ondragover = (e) => {
  if (draggedPayload && draggedPayload.kind === 'card') {
    e.preventDefault();
    discardZone.classList.add('drop-target-hover');
  }
};
discardZone.ondragleave = () => discardZone.classList.remove('drop-target-hover');
discardZone.ondrop = (e) => {
  e.preventDefault();
  discardZone.classList.remove('drop-target-hover');
  if (draggedPayload && draggedPayload.kind === 'card') {
    socket.emit('convert_energy_with_card', {
      roomCode: currentRoomCode,
      sessionToken,
      cardUid: draggedPayload.cardUid
    });
  }
  draggedPayload = null;
};

// =========================================================================
// RENDER BÀN ĐẤU CHÍNH (3 UMA CỦA MÌNH & 3 UMA ĐỐI THỦ)
// =========================================================================
socket.on('match_start', (data) => {
  finishMapReveal(data.maps || []);
  setLobbyDiscordVisible(false);
  document.getElementById('lobby-screen').style.display = 'none';
  document.getElementById('pregame-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'grid';
  document.getElementById('ui-room-code').innerText = data.roomCode;
  updateGameState(data);
});

function renderUmasToContainer(containerId, umas, isMyBoard) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  if (!umas || umas.length === 0) {
    container.innerHTML = '<div style="font-size:11px; color:#94a3b8; padding:10px;">Chưa chọn Uma</div>';
    return;
  }

  umas.forEach((u, idx) => {
    const div = document.createElement('div');
    div.className = 'uma-card-mini' + (isMyBoard && lastAnimatedUmaIndex === idx ? ' slam-anim' : '');
    div.title = 'Chuột phải vào Uma để xem Full Thông tin, Pot Skills & Đổi Style chạy';

    div.oncontextmenu = (e) => {
      if (e.target.classList.contains('mini-eq-icon')) return;
      e.preventDefault();
      if (typeof openUmaDetailModal === 'function') {
        openUmaDetailModal(u, idx, isMyBoard);
      }
    };

    if (isMyBoard) {
      div.ondragover = (e) => {
        e.preventDefault();
        div.classList.add('drop-target-hover');
      };
      div.ondragleave = () => div.classList.remove('drop-target-hover');
      div.ondrop = (e) => {
        e.preventDefault();
        div.classList.remove('drop-target-hover');
        lastAnimatedUmaIndex = idx;
        if (!draggedPayload) return;

        if (draggedPayload.kind === 'card') {
          handleCardDropOnUma(draggedPayload.cardUid, idx);
        } else if (draggedPayload.kind === 'energy') {
          socket.emit('train_uma_with_energy', { roomCode: currentRoomCode, sessionToken, umaIndex: idx });
        } else if (draggedPayload.kind === 'rest') {
          socket.emit('rest_uma', { roomCode: currentRoomCode, sessionToken, umaIndex: idx });
        } else if (draggedPayload.kind === 'item') {
          socket.emit('use_inventory_item', {
            roomCode: currentRoomCode,
            sessionToken,
            itemUid: draggedPayload.itemUid,
            umaIndex: idx
          });
        }
        draggedPayload = null;
      };
    }

    const failColor = u.failRate >= 25 ? '#f43f5e' : u.failRate > 0 ? '#facc15' : '#4ade80';
    const eqCards = u.equippedCards || [];
    const skills = u.skills || [];
    const aptBar = typeof renderCompactAptitudesBar === 'function'
      ? renderCompactAptitudesBar(u.aptitudes)
      : `Sân: <b>${u.aptitudes.Turf}/${u.aptitudes.Dirt}</b>`;

    div.innerHTML = `
      <div>
        <div class="uma-board-top">
          <img class="uma-board-avatar" src="${u.icon}" onerror="if(this.src!=='${u.fallbackIcon||''}' && '${u.fallbackIcon||''}'){this.src='${u.fallbackIcon}';}else{this.src='${fallbackAvatar(u.name, u.color)}';}">
          <div style="flex:1; min-width:0;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:4px;">
              <strong style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${u.name}</strong>
              ${renderMoodBadgeHTML(u.mood || 'Normal')}
            </div>
            <div class="unique-skill-badge" title="Unique Skill">[UNIQUE] ${u.uniqueSkill}</div>
            <div style="font-size:9.5px; color:#cbd5e1; margin-top:2px; display:flex; justify-content:space-between; align-items:center;">
              <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${aptBar}</span>
              <span style="color:${failColor}; font-weight:bold; flex-shrink:0; margin-left:4px;">Fail: ${u.failRate || 0}%</span>
            </div>
          </div>
        </div>

        <div class="equipped-strip" id="eq-strip-${containerId}-${idx}">
          <span style="font-size:9.5px; color:#64748b;">Support (${eqCards.length}/5):</span>
        </div>

        <div class="skills-list-mini">
          ${(() => {
            const learnedCardSkills = skills.filter(s => !s.fromPot);
            const goldPotSkills = skills.filter(s => s.fromPot && s.isGold);
            const displaySkills = [...learnedCardSkills, ...goldPotSkills];

            if (displaySkills.length === 0) {
              return '<span style="font-size:9.5px; color:#64748b;">Chưa có kỹ năng phụ</span>';
            }

            return displaySkills.map(s => {
              if (!s.fromPot) {
                return `<span class="skill-pill ${s.isGold ? 'gold' : ''}" style="${!s.isGold ? 'border-color:#38bdf8; color:#bae6fd; background:#0c4a6e;' : ''}">
                  ${s.isGold ? '[GOLD★] ' : '[CARD] '}${s.name}
                </span>`;
              }
              return `<span class="skill-pill gold" style="opacity:0.92;">[POT★] ${s.name}</span>`;
            }).join('');
          })()}
        </div>
      </div>

      <div class="stat-grid-mini">
        <div class="stat-cell" title="Speed">${renderStatIconHTML('Speed', 19)}<strong>${u.baseStats.spd}</strong></div>
        <div class="stat-cell" title="Stamina">${renderStatIconHTML('Stamina', 19)}<strong>${u.baseStats.sta}</strong></div>
        <div class="stat-cell" title="Power">${renderStatIconHTML('Power', 19)}<strong>${u.baseStats.pow}</strong></div>
        <div class="stat-cell" title="Guts">${renderStatIconHTML('Guts', 19)}<strong>${u.baseStats.gut}</strong></div>
        <div class="stat-cell" title="Wit">${renderStatIconHTML('Wit', 19)}<strong>${u.baseStats.wit}</strong></div>
      </div>
    `;
    container.appendChild(div);

    const stripEl = document.getElementById(`eq-strip-${containerId}-${idx}`);
    eqCards.forEach(eq => {
      const wrap = document.createElement('div');
      const canRecall = isMyBoard && !eq.isGoldAwakened;
      wrap.className = 'mini-eq-wrapper' + (canRecall ? ' recallable' : '');

      const tipText = canRecall
        ? `${eq.name}\n• Click trái (hoặc kéo về Tay): Thu hồi thẻ về lại trên tay\n• Chuột phải: Xem Full Art`
        : `${eq.name} (Đã khóa Gold Skill — Chuột phải xem Full Art)`;

      wrap.innerHTML = `
        <img class="mini-eq-icon ${eq.isGoldAwakened ? 'gold-awakened' : ''}" src="${eq.icon}" onerror="this.src='${fallbackAvatar(eq.type, '#475569')}'" title="${tipText}">
        ${renderStatIconHTML(eq.type, 13, 'mini-eq-type-badge')}
      `;

      if (canRecall) {
        wrap.onclick = (e) => {
          e.stopPropagation();
          socket.emit('unequip_card_from_uma', {
            roomCode: currentRoomCode,
            sessionToken,
            umaIndex: idx,
            cardUid: eq.uid
          });
        };
        wrap.draggable = true;
        wrap.ondragstart = (e) => {
          draggedPayload = { kind: 'recall_card', umaIndex: idx, cardUid: eq.uid };
          e.dataTransfer.setData('text/plain', eq.uid);
        };
      }

      wrap.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        openCardZoom(eq);
      };
      stripEl.appendChild(wrap);
    });
  });
}

// =========================================================================
// CẬP NHẬT TRẠNG THÁI BÀN ĐẤU MỖI LƯỢT
// =========================================================================
function updateGameState(data) {
  latestGameState = data;
  setLobbyDiscordVisible(false);
  document.getElementById('lobby-screen').style.display = 'none';
  document.getElementById('pregame-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'grid';

  if (data.turnBanner) playTurnBannerAnimation(data.turnBanner.title, data.turnBanner.subtitle);
  if (data.actionToast) showToast(data.actionToast);

  const myScoreEl = document.getElementById('ui-my-score');
  const oppScoreEl = document.getElementById('ui-opp-score');
  if (myScoreEl) myScoreEl.innerText = data.myScore || 0;
  if (oppScoreEl && data.opponent) oppScoreEl.innerText = data.opponent.score || 0;

  if (typeof renderInventoryBag === 'function') {
    renderInventoryBag(data.myInventory, data.megaphoneBuff);
  }
  if (data.pendingGlobalEvent && typeof triggerGlobalEventModal === 'function') {
    triggerGlobalEventModal(data.pendingGlobalEvent);
  }

  const lvLabel = data.year === 1 ? 'Lv.1' : (data.year === 2 ? 'Lv.3' : 'Lv.5 MAX');
  let specialTag = ` | [Training ${lvLabel}]`;
  if ([3, 6, 9].includes(data.turn)) specialTag += ' | [GLOBAL EVENT]';
  if (data.year >= 2 && [7, 8].includes(data.turn)) specialTag += ' | [SUMMER CAMP x1.5]';

  document.getElementById('ui-stage-title').innerText =
    `Giai đoạn: Năm ${data.year} - Lượt ${data.turn}/10${specialTag}`;

  const orb = document.getElementById('ui-current-energy');
  if (data.energyUsed) {
    orb.innerHTML = `${renderStatIconHTML(data.currentEnergy, 22)} <span>Đã Dùng (${data.currentEnergy} ${lvLabel})</span>`;
    orb.classList.add('used');
  } else {
    orb.innerHTML = `${renderStatIconHTML(data.currentEnergy, 24)} <span>TRAIN ${data.currentEnergy.toUpperCase()} (${lvLabel})</span>`;
    orb.classList.remove('used');
  }

  const nextEl = document.getElementById('ui-next-energy');
  if (STAT_ICON_META[data.nextEnergy]) {
    nextEl.innerHTML = `${renderStatIconHTML(data.nextEnergy, 18)} <span>${data.nextEnergy}</span>`;
  } else {
    nextEl.innerText = data.nextEnergy;
  }

  document.getElementById('ui-deck-count').innerText = data.deckCount;

  renderMapList('ui-map-list', data.maps);
  renderUmasToContainer('ui-my-umas', data.myUmas, true);

  if (data.opponent) {
    document.getElementById('ui-opp-name').innerText = data.opponent.name;
    document.getElementById('ui-opp-hand-count').innerText = data.opponent.handCount;
    document.getElementById('ui-opp-deck-count').innerText = data.opponent.deckCount;
    renderUmasToContainer('ui-opp-umas', data.opponent.umas, false);

    const statusEl = document.getElementById('ui-opp-status');
    statusEl.innerText = data.opponent.connected ? '(Online)' : '(Disconnected)';
    statusEl.style.color = data.opponent.connected ? '#4ade80' : '#f87171';
  }

  const handEl = document.getElementById('ui-hand-list');
  handEl.ondragover = (e) => {
    if (draggedPayload && draggedPayload.kind === 'recall_card') e.preventDefault();
  };
  handEl.ondrop = (e) => {
    if (draggedPayload && draggedPayload.kind === 'recall_card') {
      e.preventDefault();
      socket.emit('unequip_card_from_uma', {
        roomCode: currentRoomCode,
        sessionToken,
        umaIndex: draggedPayload.umaIndex,
        cardUid: draggedPayload.cardUid
      });
      draggedPayload = null;
    }
  };

  handEl.innerHTML = '';
  data.myHand.forEach(card => {
    const cardDiv = document.createElement('div');
    cardDiv.className = `support-card-item type-${card.type}`;
    cardDiv.draggable = true;

    cardDiv.ondragstart = (e) => {
      cardDiv.classList.add('dragging-card');
      draggedPayload = { kind: 'card', cardUid: card.uid };
      e.dataTransfer.setData('text/plain', card.uid);
    };
    cardDiv.ondragend = () => cardDiv.classList.remove('dragging-card');
    cardDiv.oncontextmenu = (e) => {
      e.preventDefault();
      openCardZoom(card);
    };

    cardDiv.innerHTML = `
      <div class="card-thumb-wrap">
        <img class="support-card-icon" src="${card.icon}" onerror="this.src='${fallbackAvatar(card.type, '#475569')}'">
        ${renderStatIconHTML(card.type, 17, 'card-type-corner')}
      </div>
      <div style="flex:1; min-width:0;">
        <div style="font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${card.name}</div>
        <div style="color:#cbd5e1; margin-top:2px;"><span class="skill-tag-label tag-white">W</span>${card.whiteSkill}</div>
        <div style="color:#facc15; margin-top:1px;"><span class="skill-tag-label tag-gold">G</span>${card.goldSkill}</div>
      </div>
    `;
    handEl.appendChild(cardDiv);
  });
}

function sendEndTurnRequest() {
  const btn = document.getElementById('btn-request-turn');
  btn.innerText = 'Đang chờ đối thủ...';
  btn.style.background = '#64748b';
  btn.disabled = true;
  lastAnimatedUmaIndex = null;
  socket.emit('request_next_turn', { roomCode: currentRoomCode, sessionToken });
}

document.getElementById('btn-request-turn').onclick = () => {
  if (latestGameState && !latestGameState.energyUsed) {
    document.getElementById('skip-warning-modal').style.display = 'flex';
    return;
  }
  sendEndTurnRequest();
};

document.getElementById('btn-force-end-turn').onclick = () => {
  document.getElementById('skip-warning-modal').style.display = 'none';
  sendEndTurnRequest();
};

socket.on('turn_ready_update', ({ confirmedCount, total }) => {
  const btn = document.getElementById('btn-request-turn');
  btn.innerText = `Kết Thúc Lượt (${confirmedCount}/${total})`;
  if (confirmedCount === total) {
    setTimeout(() => {
      btn.innerText = `Kết Thúc Lượt (0/2)`;
      btn.style.background = '#f59e0b';
      btn.disabled = false;
    }, 200);
  }
});

socket.on('state_updated', (data) => updateGameState(data));

socket.on('race_started', (racePacket) => {
  if (typeof openRaceViewerModal === 'function') {
    openRaceViewerModal(racePacket);
  }
});

socket.on('race_confirm_update', ({ readyCount, total }) => {
  const btn = document.getElementById('btn-confirm-race-next');
  if (btn && !currentRacePacket?.matchWinner) {
    btn.innerText = `Xác Nhận & Tiếp Tục (${readyCount}/${total})`;
  }
});

socket.on('close_race_modal', () => {
  const modal = document.getElementById('race-viewer-modal');
  if (modal) modal.style.display = 'none';
  const btnTurn = document.getElementById('btn-request-turn');
  if (btnTurn) {
    btnTurn.innerText = 'Kết Thúc Lượt (0/2)';
    btnTurn.style.background = '#f59e0b';
    btnTurn.disabled = false;
  }
});

socket.on('opponent_disconnected', ({ name }) => {
  const modal = document.getElementById('disconnect-modal');
  document.getElementById('modal-title').innerText = 'ĐỐI THỦ MẤT KẾT NỐI';
  document.getElementById('modal-desc').innerText = `${name} đã ngắt kết nối. Đang chờ kết nối lại...`;
  document.getElementById('btn-modal-ok').style.display = 'none';
  const timerEl = document.getElementById('countdown-timer');
  modal.style.display = 'flex';

  let timeLeft = 30;
  timerEl.innerText = timeLeft + 's';
  timerEl.style.display = 'block';
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    timeLeft--;
    timerEl.innerText = timeLeft + 's';
    if (timeLeft <= 0) clearInterval(countdownInterval);
  }, 1000);
});

socket.on('opponent_reconnected', () => {
  if (countdownInterval) clearInterval(countdownInterval);
  document.getElementById('disconnect-modal').style.display = 'none';
  const statusEl = document.getElementById('ui-opp-status');
  if (statusEl) {
    statusEl.innerText = '(Online)';
    statusEl.style.color = '#4ade80';
  }
});

socket.on('match_aborted', (msg) => {
  if (countdownInterval) clearInterval(countdownInterval);
  const modal = document.getElementById('disconnect-modal');
  document.getElementById('modal-title').innerText = 'TRẬN ĐẤU ĐÃ BỊ HỦY';
  document.getElementById('modal-desc').innerText = msg;
  document.getElementById('countdown-timer').style.display = 'none';
  document.getElementById('btn-modal-ok').style.display = 'block';
  modal.style.display = 'flex';
  localStorage.removeItem('twinkle_current_room');
});