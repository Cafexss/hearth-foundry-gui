/* ============================================================
   Hearth i18n — zh (source) / en / ja / ko
   Mechanism: Chinese source strings ARE the keys. On locale
   switch we walk the DOM, translating text nodes and common
   attributes; originals are cached on the nodes so switching
   back and forth is lossless. Dynamic JS strings go through t().
   ============================================================ */

const LOCALES = ['zh', 'en', 'ja', 'ko'];
const LOCALE_NAMES = { zh: '中文', en: 'English', ja: '日本語', ko: '한국어' };
let locale = 'zh';
const LIDX = { en: 0, ja: 1, ko: 2 };

function t(zh) {
  if (locale === 'zh') return zh;
  const e = I18N[zh];
  return (e && e[LIDX[locale]]) || zh;
}

// template variant: tf('已挖 {0} 个区块', n)
function tf(zh, ...args) {
  let s = t(zh);
  args.forEach((a, i) => { s = s.split(`{${i}}`).join(String(a)); });
  return s;
}

function setLocale(l) {
  if (!LOCALES.includes(l)) l = 'zh';
  locale = l;
  document.documentElement.lang = { zh: 'zh-CN', en: 'en', ja: 'ja', ko: 'ko' }[l];
  applyI18n();
}

function applyI18n(root = document.body) {
  // text nodes
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    if (n.__zh === undefined) {
      const trimmed = n.nodeValue.trim();
      n.__zh = trimmed && I18N[trimmed] ? n.nodeValue : null;
    }
    if (n.__zh !== null) {
      const trimmed = n.__zh.trim();
      n.nodeValue = n.__zh.replace(trimmed, t(trimmed));
    }
  }
  // attributes
  for (const attr of ['placeholder', 'data-placeholder', 'title']) {
    for (const el of root.querySelectorAll(`[${attr}]`)) {
      const cacheKey = `__zh_${attr}`;
      if (el[cacheKey] === undefined) {
        const v = el.getAttribute(attr);
        el[cacheKey] = v && I18N[v] ? v : null;
      }
      if (el[cacheKey] !== null) el.setAttribute(attr, t(el[cacheKey]));
    }
  }
  // rich-HTML nodes (contain <code> etc.)
  for (const el of root.querySelectorAll('[data-i18n-html]')) {
    const key = el.getAttribute('data-i18n-html');
    const entry = I18N_HTML[key];
    if (entry) el.innerHTML = entry[locale] || entry.zh;
  }
}

// ---------------------------------------------------------------------------
// Rich HTML fragments
// ---------------------------------------------------------------------------
const I18N_HTML = {
  'note.callsig': {
    zh: '签名格式：<code>name(argTypes)(returnTypes)</code>，例如 <code>totalSupply()(uint256)</code>。返回类型可省略，将输出原始十六进制。',
    en: 'Signature format: <code>name(argTypes)(returnTypes)</code>, e.g. <code>totalSupply()(uint256)</code>. Return types are optional; without them the raw hex is shown.',
    ja: 'シグネチャ形式：<code>name(argTypes)(returnTypes)</code>、例：<code>totalSupply()(uint256)</code>。戻り型は省略可能で、省略時は生の16進数が表示されます。',
    ko: '시그니처 형식: <code>name(argTypes)(returnTypes)</code>, 예: <code>totalSupply()(uint256)</code>. 반환 타입은 생략 가능하며 생략 시 원시 16진수가 출력됩니다.',
  },
  'note.impersonate': {
    zh: 'impersonate 开启后，在「合约调用」附加 <code>--from 该地址 --unlocked</code> 即可以该账户身份发交易（无需私钥）。',
    en: 'Once impersonation is on, add <code>--from &lt;address&gt; --unlocked</code> in Contract Calls to send transactions as that account (no private key needed).',
    ja: 'impersonate を有効にした後、「コントラクト呼び出し」で <code>--from アドレス --unlocked</code> を付ければ、そのアカウントとしてトランザクションを送信できます（秘密鍵不要）。',
    ko: 'impersonate를 켠 후 「컨트랙트 호출」에서 <code>--from 주소 --unlocked</code>를 붙이면 해당 계정으로 트랜잭션을 보낼 수 있습니다(개인키 불필요).',
  },
  'desc.chisel': {
    zh: '交互式 Solidity 沙盒，即输即得。输入 <code>!help</code> 查看内置命令。',
    en: 'An interactive Solidity sandbox with instant feedback. Type <code>!help</code> for built-in commands.',
    ja: '対話型 Solidity サンドボックス。<code>!help</code> で組み込みコマンドを表示します。',
    ko: '입력 즉시 실행되는 대화형 Solidity 샌드박스. <code>!help</code>로 내장 명령을 확인하세요.',
  },
};

// ---------------------------------------------------------------------------
// Dictionary — key = Chinese source, value = [en, ja, ko]
// ---------------------------------------------------------------------------
const I18N = {
  // ===== nav & chrome =====
  '概览': ['Overview', '概要', '개요'],
  '仪表盘': ['Dashboard', 'ダッシュボード', '대시보드'],
  'Forge · 开发': ['Forge · Develop', 'Forge · 開発', 'Forge · 개발'],
  '项目构建 & 测试': ['Build & Test', 'ビルド & テスト', '빌드 & 테스트'],
  '合约部署': ['Deploy', 'デプロイ', '배포'],
  'Cast · 链上交互': ['Cast · On-chain', 'Cast · オンチェーン', 'Cast · 온체인'],
  '转账': ['Transfer', '送金', '전송'],
  '合约调用': ['Contract Calls', 'コントラクト呼び出し', '컨트랙트 호출'],
  'ABI 工作台': ['ABI Workbench', 'ABI ワークベンチ', 'ABI 워크벤치'],
  '链上查询': ['Chain Queries', 'チェーン照会', '체인 조회'],
  '调试 & 日志': ['Debug & Logs', 'デバッグ & ログ', '디버그 & 로그'],
  '编码 & 转换': ['Encode & Convert', 'エンコード & 変換', '인코딩 & 변환'],
  '钱包工具': ['Wallet Tools', 'ウォレット', '지갑 도구'],
  '本地节点': ['Local Node', 'ローカルノード', '로컬 노드'],
  'Anvil 节点': ['Anvil Node', 'Anvil ノード', 'Anvil 노드'],
  '配置': ['Settings', '設定', '설정'],
  '网络 & 设置': ['Networks & Settings', 'ネットワーク & 設定', '네트워크 & 설정'],
  'Anvil 本地节点': ['Anvil Local Node', 'Anvil ローカルノード', 'Anvil 로컬 노드'],
  '切换主题': ['Toggle theme', 'テーマ切替', '테마 전환'],

  // ===== dashboard =====
  '当前网络状态与工具链版本一览。': ['Network status and toolchain versions at a glance.', 'ネットワーク状態とツールチェーンのバージョン一覧。', '네트워크 상태와 툴체인 버전 개요.'],
  '当前网络': ['Current Network', '現在のネットワーク', '현재 네트워크'],
  '最新区块': ['Latest Block', '最新ブロック', '최신 블록'],
  'Gas 价格': ['Gas Price', 'Gas 価格', '가스 가격'],
  'RPC 延迟': ['RPC Latency', 'RPC レイテンシ', 'RPC 지연'],
  '快速余额查询': ['Quick Balance', '残高クイック照会', '빠른 잔액 조회'],
  '地址 / ENS': ['Address / ENS', 'アドレス / ENS', '주소 / ENS'],
  '0x… 或 vitalik.eth': ['0x… or vitalik.eth', '0x… または vitalik.eth', '0x… 또는 vitalik.eth'],
  '查询': ['Query', '照会', '조회'],
  '工具链版本': ['Toolchain Versions', 'ツールチェーン', '툴체인 버전'],
  '检测中…': ['Detecting…', '検出中…', '감지 중…'],
  '快捷入口': ['Quick Actions', 'クイックアクセス', '바로가기'],
  '⇢ 转账': ['⇢ Transfer', '⇢ 送金', '⇢ 전송'],
  '↗ 部署合约': ['↗ Deploy', '↗ デプロイ', '↗ 배포'],
  '⇄ 调用合约': ['⇄ Call Contract', '⇄ 呼び出し', '⇄ 호출'],
  '▶ 启动本地节点': ['▶ Start Local Node', '▶ ノード起動', '▶ 노드 시작'],
  '›_ 打开 Solidity REPL': ['›_ Solidity REPL', '›_ Solidity REPL', '›_ Solidity REPL'],
  '⌗ 单位转换': ['⌗ Unit Convert', '⌗ 単位変換', '⌗ 단위 변환'],
  '交易记录': ['Transactions', '取引履歴', '거래 내역'],
  '本机发出的部署 / 转账 / 写入交易': ['Deploys / transfers / writes sent from this app', 'このアプリから送信した取引', '이 앱에서 보낸 트랜잭션'],
  '清空': ['Clear', 'クリア', '지우기'],
  '时间': ['Time', '時刻', '시간'],
  '类型': ['Type', '種別', '유형'],
  '网络': ['Network', 'ネットワーク', '네트워크'],
  '详情': ['Details', '詳細', '상세'],
  '交易哈希': ['Tx Hash', 'Tx ハッシュ', 'Tx 해시'],
  '暂无记录': ['No records yet', '記録なし', '기록 없음'],
  '在线': ['online', 'オンライン', '온라인'],
  'RPC 不可达': ['RPC unreachable', 'RPC 到達不可', 'RPC 연결 불가'],
  '离线': ['offline', 'オフライン', '오프라인'],

  // ===== forge =====
  '选择本地 Foundry 项目，执行 build / test / fmt / coverage 等操作。': ['Pick a local Foundry project and run build / test / fmt / coverage.', 'ローカルの Foundry プロジェクトで build / test / fmt / coverage を実行します。', '로컬 Foundry 프로젝트에서 build / test / fmt / coverage를 실행합니다.'],
  '项目目录': ['Project Directory', 'プロジェクトディレクトリ', '프로젝트 디렉터리'],
  'Foundry 项目路径（包含 foundry.toml）': ['Foundry project path (contains foundry.toml)', 'Foundry プロジェクトパス（foundry.toml を含む）', 'Foundry 프로젝트 경로 (foundry.toml 포함)'],
  '浏览…': ['Browse…', '参照…', '찾아보기…'],
  '新建项目 (forge init)': ['New Project (forge init)', '新規プロジェクト (forge init)', '새 프로젝트 (forge init)'],
  '操作': ['Actions', '操作', '작업'],
  'Fmt 格式化': ['Fmt', 'Fmt 整形', 'Fmt 포맷'],
  '测试过滤（--match-test / 可留空）': ['Test filter (--match-test, optional)', 'テストフィルタ（--match-test・省略可）', '테스트 필터 (--match-test, 선택)'],
  '附加参数': ['Extra args', '追加引数', '추가 인자'],
  '输出': ['Output', '出力', '출력'],
  '复制': ['Copy', 'コピー', '복사'],
  '■ 停止': ['■ Stop', '■ 停止', '■ 중지'],
  'forge 输出将显示在这里…': ['forge output will appear here…', 'forge の出力がここに表示されます…', 'forge 출력이 여기에 표시됩니다…'],

  // ===== deploy =====
  '基于 forge create 快速部署合约到任意网络，自动解析构造函数参数。': ['Deploy contracts to any network via forge create / forge script, with constructor args parsed automatically.', 'forge create / forge script で任意のネットワークへデプロイ。コンストラクタ引数は自動解析。', 'forge create / forge script로 어느 네트워크든 배포. 생성자 인자 자동 해석.'],
  '1 · 选择项目与合约': ['1 · Project & Contract', '1 · プロジェクトとコントラクト', '1 · 프로젝트와 컨트랙트'],
  '项目路径': ['Project path', 'プロジェクトパス', '프로젝트 경로'],
  '先构建': ['Build first', '先にビルド', '먼저 빌드'],
  '合约': ['Contract', 'コントラクト', '컨트랙트'],
  '刷新': ['Refresh', '更新', '새로고침'],
  '— 请先选择项目 —': ['— select a project first —', '— まずプロジェクトを選択 —', '— 먼저 프로젝트를 선택 —'],
  '2 · 账户与网络': ['2 · Account & Network', '2 · アカウントとネットワーク', '2 · 계정과 네트워크'],
  '部署将发送到右上角选定的网络': ['Deploys go to the network selected at the top right', 'デプロイは右上で選択中のネットワークへ送信されます', '배포는 우측 상단에서 선택한 네트워크로 전송됩니다'],
  '私钥（仅本地使用，不会存储）': ['Private key (local only, never stored)', '秘密鍵（ローカルのみ・保存されません）', '개인키 (로컬 전용, 저장되지 않음)'],
  '或 Keystore 账户名（cast wallet 管理）': ['or keystore account (managed by cast wallet)', 'または Keystore アカウント名（cast wallet 管理）', '또는 Keystore 계정명 (cast wallet 관리)'],
  'my-account（留空则使用私钥）': ['my-account (leave empty to use the private key)', 'my-account（空欄なら秘密鍵を使用）', 'my-account (비우면 개인키 사용)'],
  'Keystore 密码（使用账户名时必填）': ['Keystore password (required with account name)', 'Keystore パスワード（アカウント名使用時は必須）', 'Keystore 비밀번호 (계정명 사용 시 필수)'],
  '密码': ['Password', 'パスワード', '비밀번호'],
  'ETH 附带金额（可选）': ['ETH value (optional)', '送付する ETH（任意）', '첨부 ETH (선택)'],
  'Gas Limit（可选）': ['Gas limit (optional)', 'Gas 上限（任意）', '가스 한도 (선택)'],
  '自动估算': ['auto-estimated', '自動見積り', '자동 추정'],
  '--legacy 等': ['--legacy etc.', '--legacy など', '--legacy 등'],
  '部署后自动验证（需在设置中配置 Etherscan API Key）': ['Auto-verify after deploy (needs an Etherscan API key in Settings)', 'デプロイ後に自動検証（設定で Etherscan API キーが必要）', '배포 후 자동 검증 (설정에서 Etherscan API 키 필요)'],
  '3 · 单合约部署 (forge create)': ['3 · Single contract (forge create)', '3 · 単一コントラクト (forge create)', '3 · 단일 컨트랙트 (forge create)'],
  '3 · 脚本部署 (forge script)': ['3 · Script deploy (forge script)', '3 · スクリプト (forge script)', '3 · 스크립트 배포 (forge script)'],
  '模拟估算 (dry-run)': ['Simulate (dry-run)', 'シミュレーション (dry-run)', '시뮬레이션 (dry-run)'],
  '🚀 部署合约': ['🚀 Deploy', '🚀 デプロイ', '🚀 배포'],
  '部署脚本（script/*.s.sol）': ['Deploy script (script/*.s.sol)', 'デプロイスクリプト（script/*.s.sol）', '배포 스크립트 (script/*.s.sol)'],
  '入口函数 --sig（默认 run()）': ['Entry --sig (default run())', 'エントリ --sig（既定 run()）', '엔트리 --sig (기본 run())'],
  '附加参数（如 --slow --skip-simulation）': ['Extra args (e.g. --slow --skip-simulation)', '追加引数（例：--slow --skip-simulation）', '추가 인자 (예: --slow --skip-simulation)'],
  '模拟执行（不广播）': ['Simulate (no broadcast)', 'シミュレーション（ブロードキャストなし）', '시뮬레이션 (브로드캐스트 없음)'],
  '🚀 广播执行 (--broadcast)': ['🚀 Broadcast (--broadcast)', '🚀 ブロードキャスト (--broadcast)', '🚀 브로드캐스트 (--broadcast)'],
  '脚本使用上方「账户与网络」的私钥 / Keystore 账户签名；模拟执行无需签名信息。': ['Scripts sign with the key / keystore account from "Account & Network" above; simulation needs no signer.', 'スクリプトは上の「アカウントとネットワーク」の鍵で署名します。シミュレーションには署名情報は不要です。', '스크립트는 위 「계정과 네트워크」의 키로 서명합니다. 시뮬레이션에는 서명 정보가 필요 없습니다.'],
  '部署日志将显示在这里…': ['Deploy logs will appear here…', 'デプロイログがここに表示されます…', '배포 로그가 여기에 표시됩니다…'],

  // ===== transfer =====
  '原生代币（ETH 等 gas 币）与 ERC-20 代币转账，发送到右上角选定的网络。': ['Send native coins (ETH etc.) and ERC-20 tokens on the network selected at the top right.', 'ネイティブコイン（ETH など）と ERC-20 トークンを右上で選択中のネットワークで送金します。', '네이티브 코인(ETH 등)과 ERC-20 토큰을 우측 상단에서 선택한 네트워크로 전송합니다.'],
  '发送账户': ['Sender Account', '送信アカウント', '보내는 계정'],
  '本页两种转账共用': ['shared by both transfer types on this page', 'このページの両方の送金で共用', '이 페이지의 두 전송 유형에서 공용'],
  '或 Keystore 账户名': ['or keystore account', 'または Keystore アカウント名', '또는 Keystore 계정명'],
  '查看地址与余额': ['Show address & balance', 'アドレスと残高を表示', '주소와 잔액 보기'],
  '原生代币转账': ['Native Transfer', 'ネイティブ送金', '네이티브 전송'],
  'ETH / BNB / MATIC …': ['ETH / BNB / MATIC …', 'ETH / BNB / MATIC …', 'ETH / BNB / MATIC …'],
  '接收地址 / ENS': ['Recipient / ENS', '受取アドレス / ENS', '받는 주소 / ENS'],
  '0x… 或 name.eth': ['0x… or name.eth', '0x… または name.eth', '0x… 또는 name.eth'],
  '金额（单位：ether）': ['Amount (in ether)', '金額（ether 単位）', '금액 (ether 단위)'],
  '全部余额（留 gas）': ['Max (keep gas)', '全額（gas 分を残す）', '전액 (가스 제외)'],
  '发送': ['Send', '送信', '전송'],
  'ERC-20 代币转账': ['ERC-20 Transfer', 'ERC-20 送金', 'ERC-20 전송'],
  '代币合约地址': ['Token contract address', 'トークンコントラクトアドレス', '토큰 컨트랙트 주소'],
  '查询代币': ['Fetch token', 'トークン照会', '토큰 조회'],
  '数量（人类可读，自动按 decimals 换算）': ['Amount (human-readable, converted by decimals)', '数量（decimals で自動換算）', '수량 (decimals로 자동 환산)'],
  '查我的代币余额': ['My token balance', '自分の残高を照会', '내 토큰 잔액'],
  '授权 approve / allowance': ['Approve / allowance', 'Approve / allowance', 'Approve / allowance'],
  '被授权方 spender': ['Spender', 'Spender（承認先）', 'Spender (승인 대상)'],
  '0x…（如 DEX Router 地址）': ['0x… (e.g. a DEX router)', '0x…（例：DEX Router）', '0x… (예: DEX Router)'],
  '授权数量（人类可读）': ['Approve amount (human-readable)', '承認数量', '승인 수량'],
  '无限授权': ['Approve ∞', '無制限承認', '무제한 승인'],
  '授权': ['Approve', '承認', '승인'],
  '查 allowance': ['Check allowance', 'allowance 照会', 'allowance 조회'],

  // ===== interact =====
  '读取合约状态（cast call）或发送交易（cast send）。': ['Read contract state (cast call) or send transactions (cast send).', 'コントラクトの読み取り（cast call）とトランザクション送信（cast send）。', '컨트랙트 상태 읽기(cast call)와 트랜잭션 전송(cast send).'],
  '读取 (call)': ['Read (call)', '読み取り (call)', '읽기 (call)'],
  '写入 (send)': ['Write (send)', '書き込み (send)', '쓰기 (send)'],
  'Raw Calldata（未开源合约）': ['Raw Calldata (unverified contracts)', 'Raw Calldata（未公開コントラクト）', 'Raw Calldata (미공개 컨트랙트)'],
  '合约地址': ['Contract address', 'コントラクトアドレス', '컨트랙트 주소'],
  '方法签名': ['Function signature', '関数シグネチャ', '함수 시그니처'],
  '参数（空格分隔，字符串加引号）': ['Args (space-separated, quote strings)', '引数（スペース区切り・文字列は引用符）', '인자 (공백 구분, 문자열은 따옴표)'],
  '参数': ['Args', '引数', '인자'],
  '调用': ['Call', '呼び出し', '호출'],
  '私钥': ['Private key', '秘密鍵', '개인키'],
  '或 Keystore 账户': ['or keystore account', 'または Keystore アカウント', '또는 Keystore 계정'],
  'Keystore 密码': ['Keystore password', 'Keystore パスワード', 'Keystore 비밀번호'],
  '使用账户名时必填': ['required with account name', 'アカウント名使用時は必須', '계정명 사용 시 필수'],
  'ETH 金额（可选）': ['ETH value (optional)', 'ETH 金額（任意）', 'ETH 금액 (선택)'],
  '估算 Gas': ['Estimate gas', 'Gas 見積り', '가스 추정'],
  '签名并发送': ['Sign & send', '署名して送信', '서명 후 전송'],
  '直接发送原始 calldata，无需 ABI —— 适用于未开源 / 未验证的合约。可先在「编码 & 转换」页用 4byte 反查或 ABI 编码生成 calldata。': ['Send raw calldata without an ABI — works with unverified contracts. Use the Encode & Convert page to build calldata via 4byte lookup or ABI encoding.', 'ABI なしで生の calldata を送信 — 未検証コントラクトにも対応。「エンコード & 変換」ページで calldata を作成できます。', 'ABI 없이 원시 calldata를 전송 — 미검증 컨트랙트에도 사용 가능. 「인코딩 & 변환」 페이지에서 calldata를 만들 수 있습니다.'],
  'Calldata（0x 开头的十六进制）': ['Calldata (0x-prefixed hex)', 'Calldata（0x 始まりの16進数）', 'Calldata (0x로 시작하는 16진수)'],
  '私钥（写入时需要）': ['Private key (needed for writes)', '秘密鍵（書き込み時に必要）', '개인키 (쓰기 시 필요)'],
  '返回值解码类型（可选，如 uint256 / (address,uint256)）': ['Return type for decoding (optional, e.g. uint256 / (address,uint256))', '戻り値のデコード型（任意）', '반환값 디코딩 타입 (선택)'],
  '留空则输出原始十六进制': ['leave empty for raw hex', '空欄なら生の16進数を出力', '비우면 원시 16진수 출력'],
  '静态调用 (eth_call)': ['Static call (eth_call)', '静的呼び出し (eth_call)', '정적 호출 (eth_call)'],
  '签名并发送交易': ['Sign & send transaction', '署名してトランザクション送信', '서명 후 트랜잭션 전송'],
  '原始 Cast 命令': ['Raw Cast Command', '生の Cast コマンド', 'Raw Cast 명령'],
  '高级用法：直接输入 cast 子命令': ['advanced: type a cast subcommand directly', '上級者向け：cast サブコマンドを直接入力', '고급: cast 하위 명령을 직접 입력'],
  'storage 0xdead… 0 --rpc-url …（无需写 cast 前缀，回车执行）': ['storage 0xdead… 0 (no cast prefix, Enter to run)', 'storage 0xdead… 0（cast プレフィックス不要・Enter で実行）', 'storage 0xdead… 0 (cast 접두어 불필요, Enter로 실행)'],
  '执行': ['Run', '実行', '실행'],

  // ===== workbench =====
  '加载合约 ABI 后，点选函数直接调用 —— 无需手写签名。': ['Load a contract ABI and call functions with a click — no hand-written signatures.', 'ABI を読み込めば、クリックで関数を呼び出せます — シグネチャの手書き不要。', 'ABI를 불러오면 클릭으로 함수를 호출할 수 있습니다 — 시그니처 수작성 불필요.'],
  '合约与 ABI': ['Contract & ABI', 'コントラクトと ABI', '컨트랙트와 ABI'],
  '从项目编译产物加载': ['From project artifacts', 'プロジェクト成果物から', '프로젝트 아티팩트에서'],
  '粘贴 ABI JSON': ['Paste ABI JSON', 'ABI JSON を貼り付け', 'ABI JSON 붙여넣기'],
  '加载 ABI': ['Load ABI', 'ABI 読み込み', 'ABI 불러오기'],
  'ABI JSON（支持完整 artifact 或纯 ABI 数组）': ['ABI JSON (full artifact or bare ABI array)', 'ABI JSON（artifact 全体または ABI 配列）', 'ABI JSON (전체 artifact 또는 ABI 배열)'],
  '解析 ABI': ['Parse ABI', 'ABI を解析', 'ABI 파싱'],
  '签名账户': ['Signer', '署名アカウント', '서명 계정'],
  '写函数发送交易时使用': ['used when sending write transactions', '書き込みトランザクション送信時に使用', '쓰기 트랜잭션 전송 시 사용'],
  '读函数': ['Read Functions', '読み取り関数', '읽기 함수'],
  '⚡ 一键读取全部无参函数': ['⚡ Read all no-arg functions', '⚡ 引数なし関数を一括読み取り', '⚡ 무인자 함수 일괄 읽기'],
  '写函数': ['Write Functions', '書き込み関数', '쓰기 함수'],
  '— 选择合约 —': ['— select a contract —', '— コントラクトを選択 —', '— 컨트랙트 선택 —'],
  '— 选择要部署的合约 —': ['— select a contract to deploy —', '— デプロイするコントラクトを選択 —', '— 배포할 컨트랙트 선택 —'],
  '— 选择部署脚本 —': ['— select a script —', '— スクリプトを選択 —', '— 스크립트 선택 —'],
  '（项目中没有 script/*.s.sol）': ['(no script/*.s.sol in project)', '（script/*.s.sol がありません）', '(script/*.s.sol 없음)'],
  '✗ 该目录不是 Foundry 项目': ['✗ not a Foundry project', '✗ Foundry プロジェクトではありません', '✗ Foundry 프로젝트가 아님'],
  '该合约没有此类函数': ['No functions of this kind', 'この種類の関数はありません', '이 유형의 함수가 없습니다'],

  // ===== query =====
  '余额、交易、区块、Nonce、合约代码等只读查询。': ['Read-only lookups: balances, transactions, blocks, nonces, contract code.', '残高・取引・ブロック・Nonce・コードの読み取り照会。', '잔액·트랜잭션·블록·논스·코드 읽기 전용 조회.'],
  '账户': ['Account', 'アカウント', '계정'],
  '0x… 或 name.eth（q）': ['0x… or name.eth', '0x… または name.eth', '0x… 또는 name.eth'],
  '余额': ['Balance', '残高', '잔액'],
  '合约代码': ['Code', 'コード', '코드'],
  '代码大小': ['Code size', 'コードサイズ', '코드 크기'],
  '交易': ['Transaction', 'トランザクション', '트랜잭션'],
  '交易详情': ['Tx details', 'Tx 詳細', 'Tx 상세'],
  '回执 Receipt': ['Receipt', 'レシート', '영수증'],
  '区块': ['Block', 'ブロック', '블록'],
  '区块号 / latest': ['Block number / latest', 'ブロック番号 / latest', '블록 번호 / latest'],
  '存储槽读取': ['Storage Slot', 'ストレージスロット', '스토리지 슬롯'],
  '槽位': ['Slot', 'スロット', '슬롯'],
  '读取': ['Read', '読み取り', '읽기'],

  // ===== debug =====
  '交易 Trace 重放、模拟调用跟踪与链上事件日志查询。': ['Replay transaction traces, trace simulated calls, and query event logs.', 'トランザクションの Trace 再生、シミュレーション追跡、イベントログ照会。', '트랜잭션 트레이스 재생, 시뮬레이션 추적, 이벤트 로그 조회.'],
  '交易 Trace 重放': ['Tx Trace Replay', 'Tx Trace 再生', 'Tx 트레이스 재생'],
  '快速模式（跳过同区块前置交易）': ['Quick mode (skip preceding txs in block)', 'クイックモード（同ブロックの先行 Tx をスキップ）', '빠른 모드 (같은 블록의 선행 Tx 건너뜀)'],
  '▶ 重放并显示 Trace': ['▶ Replay & trace', '▶ 再生して Trace 表示', '▶ 재생 & 트레이스'],
  '模拟调用 Trace': ['Simulated Call Trace', 'シミュレーション Trace', '시뮬레이션 트레이스'],
  '--from（可选）': ['--from (optional)', '--from（任意）', '--from (선택)'],
  '▶ 模拟并跟踪': ['▶ Simulate & trace', '▶ シミュレーション実行', '▶ 시뮬레이션 & 추적'],
  'Trace 输出': ['Trace Output', 'Trace 出力', '트레이스 출력'],
  '调用栈 Trace 将显示在这里…': ['Call-stack trace will appear here…', 'コールスタック Trace がここに表示されます…', '콜스택 트레이스가 여기에 표시됩니다…'],
  '事件日志查询': ['Event Logs', 'イベントログ照会', '이벤트 로그 조회'],
  '合约地址（可选）': ['Contract address (optional)', 'コントラクトアドレス（任意）', '컨트랙트 주소 (선택)'],
  '事件签名（可选）': ['Event signature (optional)', 'イベントシグネチャ（任意）', '이벤트 시그니처 (선택)'],
  '起始区块': ['From block', '開始ブロック', '시작 블록'],
  '结束区块': ['To block', '終了ブロック', '끝 블록'],
  'earliest / 数字': ['earliest / number', 'earliest / 数値', 'earliest / 숫자'],
  '查询日志': ['Query logs', 'ログ照会', '로그 조회'],
  '日志将显示在这里…': ['Logs will appear here…', 'ログがここに表示されます…', '로그가 여기에 표시됩니다…'],

  // ===== tools =====
  '常用的单位转换、ABI 编解码、哈希与地址工具，全部离线执行。': ['Everyday unit conversion, ABI codecs, hashing and address tools — all offline.', '単位変換・ABI エンコード/デコード・ハッシュ・アドレスツール。すべてオフライン実行。', '단위 변환·ABI 인코딩/디코딩·해시·주소 도구. 모두 오프라인 실행.'],
  '单位转换': ['Unit Conversion', '単位変換', '단위 변환'],
  '数值': ['Value', '数値', '값'],
  '方向': ['Direction', '方向', '방향'],
  '转换': ['Convert', '変換', '변환'],
  '进制转换': ['Base Conversion', '基数変換', '진수 변환'],
  '数值（自动识别 0x 前缀）': ['Value (0x prefix auto-detected)', '数値（0x 接頭辞を自動判別）', '값 (0x 접두어 자동 인식)'],
  '目标': ['Target', '変換先', '대상'],
  '十进制 → Hex': ['Decimal → Hex', '10進数 → Hex', '10진수 → Hex'],
  'Hex → 十进制': ['Hex → Decimal', 'Hex → 10進数', 'Hex → 10진수'],
  'Keccak-256 哈希': ['Keccak-256 Hash', 'Keccak-256 ハッシュ', 'Keccak-256 해시'],
  '任意文本 或 0x 十六进制数据': ['any text or 0x hex data', '任意のテキストまたは 0x 16進データ', '텍스트 또는 0x 16진 데이터'],
  '哈希': ['Hash', 'ハッシュ', '해시'],
  '函数选择器 / 事件主题': ['Selector / Event Topic', 'セレクタ / イベントトピック', '셀렉터 / 이벤트 토픽'],
  '函数 4byte': ['Function 4byte', '関数 4byte', '함수 4byte'],
  '事件 topic0': ['Event topic0', 'イベント topic0', '이벤트 topic0'],
  '计算': ['Compute', '計算', '계산'],
  'ABI 编码': ['ABI Encode', 'ABI エンコード', 'ABI 인코딩'],
  '函数签名': ['Function signature', '関数シグネチャ', '함수 시그니처'],
  '模式': ['Mode', 'モード', '모드'],
  'calldata（带选择器）': ['calldata (with selector)', 'calldata（セレクタ付き）', 'calldata (셀렉터 포함)'],
  '仅参数编码': ['args only', '引数のみ', '인자만'],
  '编码': ['Encode', 'エンコード', '인코딩'],
  'Calldata 解码': ['Decode Calldata', 'Calldata デコード', 'Calldata 디코딩'],
  '解码': ['Decode', 'デコード', '디코딩'],
  '地址工具': ['Address Tools', 'アドレスツール', '주소 도구'],
  '0x地址': ['0x address', '0x アドレス', '0x 주소'],
  '校验和格式化': ['Checksum format', 'チェックサム整形', '체크섬 포맷'],
  '计算 CREATE 地址（输入部署者）': ['Compute CREATE address (input deployer)', 'CREATE アドレス計算（デプロイヤーを入力）', 'CREATE 주소 계산 (배포자 입력)'],
  '4byte 反查': ['4byte Lookup', '4byte 逆引き', '4byte 역조회'],
  '通过公共选择器库查询': ['via the public selector database', '公開セレクタ DB を照会', '공개 셀렉터 DB 조회'],
  '0xa9059cbb 或完整 calldata': ['0xa9059cbb or full calldata', '0xa9059cbb または完全な calldata', '0xa9059cbb 또는 전체 calldata'],
  '反查': ['Lookup', '逆引き', '역조회'],

  // ===== wallet =====
  '生成钱包、私钥推导地址、消息签名与 Keystore 管理。': ['Generate wallets, derive addresses, sign & verify messages, manage keystores.', 'ウォレット生成・アドレス導出・メッセージ署名・Keystore 管理。', '지갑 생성·주소 유도·메시지 서명·Keystore 관리.'],
  '生成新钱包': ['New Wallet', '新規ウォレット', '새 지갑'],
  '本地随机生成，助记词和私钥只显示一次，请妥善保存。': ['Generated locally; the mnemonic and key are shown only once — store them safely.', 'ローカルで生成されます。ニーモニックと秘密鍵は一度しか表示されません。', '로컬에서 생성됩니다. 니모닉과 개인키는 한 번만 표시됩니다.'],
  '生成钱包': ['Generate wallet', 'ウォレット生成', '지갑 생성'],
  '生成助记词钱包': ['Generate mnemonic', 'ニーモニック生成', '니모닉 생성'],
  '私钥 → 地址': ['Key → Address', '秘密鍵 → アドレス', '개인키 → 주소'],
  '0x私钥': ['0x private key', '0x 秘密鍵', '0x 개인키'],
  '推导地址': ['Derive address', 'アドレス導出', '주소 유도'],
  '消息签名': ['Sign Message', 'メッセージ署名', '메시지 서명'],
  '消息': ['Message', 'メッセージ', '메시지'],
  '签名': ['Sign', '署名', '서명'],
  '签名验证': ['Verify Signature', '署名検証', '서명 검증'],
  '签名者地址': ['Signer address', '署名者アドレス', '서명자 주소'],
  '验证签名': ['Verify', '検証', '검증'],
  'Keystore 账户': ['Keystore Accounts', 'Keystore アカウント', 'Keystore 계정'],
  '~/.foundry/keystores · 供 --account 使用': ['~/.foundry/keystores · used by --account', '~/.foundry/keystores · --account で使用', '~/.foundry/keystores · --account에서 사용'],
  '账户名': ['Account name', 'アカウント名', '계정명'],
  '私钥（导入用）': ['Private key (to import)', '秘密鍵（インポート用）', '개인키 (가져오기용)'],
  'keystore 密码': ['keystore password', 'Keystore パスワード', 'Keystore 비밀번호'],
  '导入': ['Import', 'インポート', '가져오기'],
  '列出账户': ['List accounts', 'アカウント一覧', '계정 목록'],

  // ===== anvil =====
  '一键启动本地开发链，支持主网分叉，内置 10 个测试账户。': ['One-click local dev chain with mainnet forking and 10 funded test accounts.', 'ワンクリックでローカル開発チェーンを起動。メインネットフォークと 10 個のテストアカウント付き。', '원클릭 로컬 개발 체인. 메인넷 포크와 테스트 계정 10개 내장.'],
  '节点控制': ['Node Control', 'ノード制御', '노드 제어'],
  '未运行': ['stopped', '停止中', '중지됨'],
  '运行中': ['running', '実行中', '실행 중'],
  '▶ 启动节点': ['▶ Start node', '▶ ノード起動', '▶ 노드 시작'],
  '端口': ['Port', 'ポート', '포트'],
  '出块间隔（秒，留空=即时）': ['Block time (s, empty = instant)', 'ブロック間隔（秒・空欄で即時）', '블록 간격 (초, 비우면 즉시)'],
  '即时出块': ['instant mining', '即時マイニング', '즉시 채굴'],
  '分叉 RPC（可选 — 填入后 fork 该网络）': ['Fork RPC (optional — forks that network)', 'フォーク RPC（任意 — 指定ネットワークを fork）', '포크 RPC (선택 — 해당 네트워크를 포크)'],
  '分叉区块（可选）': ['Fork block (optional)', 'フォークブロック（任意）', '포크 블록 (선택)'],
  '启动后可在右上角切换到「Anvil Local」网络，直接对本地链部署与调用。': ['After starting, switch to the "Anvil Local" network at the top right to deploy and call against the local chain.', '起動後、右上で「Anvil Local」に切り替えるとローカルチェーンに直接デプロイ・呼び出しできます。', '시작 후 우측 상단에서 「Anvil Local」로 전환하면 로컬 체인에 바로 배포·호출할 수 있습니다.'],
  '链操作': ['Chain Operations', 'チェーン操作', '체인 조작'],
  '通过 cast rpc 作用于右上角当前网络（Anvil / 分叉链专用）': ['via cast rpc against the current network (Anvil / forked chains only)', 'cast rpc で現在のネットワークに作用（Anvil / フォークチェーン専用）', 'cast rpc로 현재 네트워크에 적용 (Anvil/포크 체인 전용)'],
  '挖块数量': ['Blocks to mine', 'マイニング数', '채굴할 블록 수'],
  '⛏ 挖块': ['⛏ Mine', '⛏ マイニング', '⛏ 채굴'],
  '时间快进（秒）': ['Time warp (seconds)', '時間を進める（秒）', '시간 앞으로 (초)'],
  '⏩ 快进并挖块': ['⏩ Warp & mine', '⏩ 進めてマイニング', '⏩ 진행 & 채굴'],
  '状态快照': ['State Snapshots', '状態スナップショット', '상태 스냅샷'],
  '— 暂无快照 —': ['— no snapshots —', '— スナップショットなし —', '— 스냅샷 없음 —'],
  '📸 创建': ['📸 Snapshot', '📸 作成', '📸 생성'],
  '↩ 回滚': ['↩ Revert', '↩ 復元', '↩ 되돌리기'],
  '设置余额 — 地址': ['Set balance — address', '残高設定 — アドレス', '잔액 설정 — 주소'],
  '余额（ETH）': ['Balance (ETH)', '残高（ETH）', '잔액 (ETH)'],
  '💰 设置余额': ['💰 Set balance', '💰 残高設定', '💰 잔액 설정'],
  '模拟账户 impersonate（大户测试）': ['Impersonate account (whale testing)', 'アカウント偽装 impersonate（クジラテスト）', '계정 가장 impersonate (고래 테스트)'],
  '开启': ['Enable', '有効化', '켜기'],
  '停止': ['Stop', '停止', '중지'],
  '测试账户': ['Test Accounts', 'テストアカウント', '테스트 계정'],
  '点击地址或「私钥」即可复制': ['click an address or "copy key" to copy', 'アドレスや「秘密鍵をコピー」をクリックでコピー', '주소나 「개인키 복사」를 클릭하면 복사됩니다'],
  '地址': ['Address', 'アドレス', '주소'],
  '复制私钥': ['Copy key', '秘密鍵をコピー', '개인키 복사'],
  '节点日志': ['Node Logs', 'ノードログ', '노드 로그'],
  'anvil 日志将显示在这里…': ['anvil logs will appear here…', 'anvil のログがここに表示されます…', 'anvil 로그가 여기에 표시됩니다…'],

  // ===== chisel =====
  'Chisel — Solidity REPL': ['Chisel — Solidity REPL', 'Chisel — Solidity REPL', 'Chisel — Solidity REPL'],
  '未启动': ['not started', '未起動', '시작 안 됨'],
  '会话进行中': ['session active', 'セッション実行中', '세션 진행 중'],
  '▶ 启动会话': ['▶ Start session', '▶ セッション開始', '▶ 세션 시작'],
  '■ 结束': ['■ End', '■ 終了', '■ 종료'],
  '点击「启动会话」，然后尝试输入：uint a = 1 + 1; 再输入 a 查看值': ['Click "Start session", then try: uint a = 1 + 1; then type a to inspect it', '「セッション開始」をクリックし、uint a = 1 + 1; と入力、次に a で値を確認', '「세션 시작」을 클릭한 뒤 uint a = 1 + 1; 입력, 이어서 a로 값 확인'],
  '输入 Solidity 语句，回车执行…': ['Type Solidity, Enter to run…', 'Solidity 文を入力し Enter で実行…', 'Solidity 문을 입력하고 Enter로 실행…'],

  // ===== settings =====
  '管理 RPC 网络列表与全局默认项，配置保存在本地。': ['Manage RPC networks and defaults; config is stored locally.', 'RPC ネットワークと既定値を管理。設定はローカルに保存されます。', 'RPC 네트워크와 기본값을 관리. 설정은 로컬에 저장됩니다.'],
  '网络列表': ['Networks', 'ネットワーク一覧', '네트워크 목록'],
  '名称': ['Name', '名称', '이름'],
  '浏览器': ['Explorer', 'エクスプローラ', '익스플로러'],
  '浏览器 URL（可选）': ['Explorer URL (optional)', 'エクスプローラ URL（任意）', '익스플로러 URL (선택)'],
  '添加网络': ['Add network', 'ネットワーク追加', '네트워크 추가'],
  '用于部署后自动验证合约': ['used for auto-verification after deploy', 'デプロイ後の自動検証に使用', '배포 후 자동 검증에 사용'],
  '保存': ['Save', '保存', '저장'],
  '关于': ['About', 'このアプリについて', '정보'],
  '应用': ['App', 'アプリ', '앱'],
  '工具链': ['Toolchain', 'ツールチェーン', '툴체인'],
  '语言 / Language': ['Language', '言語 / Language', '언어 / Language'],
  '此应用由 Claude (Fable 5) 设计与开发': ['Designed & built by Claude (Fable 5)', 'このアプリは Claude (Fable 5) が設計・開発しました', '이 앱은 Claude (Fable 5)가 설계·개발했습니다'],
  '使用': ['Use', '使用', '사용'],
  '删除': ['Delete', '削除', '삭제'],
  '当前': ['current', '現在', '현재'],

  // ===== dynamic (JS) =====
  '已复制': ['Copied', 'コピーしました', '복사됨'],
  '执行中': ['Running…', '実行中…', '실행 중…'],
  '请先选择项目目录': ['Select a project directory first', 'まずプロジェクトを選択してください', '먼저 프로젝트 디렉터리를 선택하세요'],
  '项目创建成功': ['Project created', 'プロジェクトを作成しました', '프로젝트 생성 완료'],
  '请先选择项目': ['Select a project first', 'まずプロジェクトを選択してください', '먼저 프로젝트를 선택하세요'],
  '请选择项目和合约': ['Select a project and contract', 'プロジェクトとコントラクトを選択してください', '프로젝트와 컨트랙트를 선택하세요'],
  '请选择项目和部署脚本': ['Select a project and script', 'プロジェクトとスクリプトを選択してください', '프로젝트와 스크립트를 선택하세요'],
  '请填写私钥或 Keystore 账户': ['Enter a private key or keystore account', '秘密鍵か Keystore アカウントを入力してください', '개인키 또는 Keystore 계정을 입력하세요'],
  '广播执行需要私钥或 Keystore 账户': ['Broadcasting needs a private key or keystore account', 'ブロードキャストには秘密鍵か Keystore アカウントが必要です', '브로드캐스트에는 개인키 또는 Keystore 계정이 필요합니다'],
  '请填写地址和方法签名': ['Enter an address and function signature', 'アドレスと関数シグネチャを入力してください', '주소와 함수 시그니처를 입력하세요'],
  '请填写合约地址和 calldata': ['Enter a contract address and calldata', 'コントラクトアドレスと calldata を入力してください', '컨트랙트 주소와 calldata를 입력하세요'],
  '请填写地址': ['Enter an address', 'アドレスを入力してください', '주소를 입력하세요'],
  '请填写交易哈希': ['Enter a transaction hash', 'トランザクションハッシュを入力してください', '트랜잭션 해시를 입력하세요'],
  '请填写合约地址': ['Enter a contract address', 'コントラクトアドレスを入力してください', '컨트랙트 주소를 입력하세요'],
  '请填写接收地址和金额': ['Enter a recipient and amount', '受取アドレスと金額を入力してください', '받는 주소와 금액을 입력하세요'],
  '金额格式不正确': ['Invalid amount', '金額の形式が不正です', '금액 형식이 잘못되었습니다'],
  '数量格式不正确': ['Invalid amount', '数量の形式が不正です', '수량 형식이 잘못되었습니다'],
  'RPC 查询失败': ['RPC query failed', 'RPC 照会に失敗しました', 'RPC 조회 실패'],
  '「全部余额」需要填写私钥': ['"Max" needs a private key', '「全額」には秘密鍵が必要です', '「전액」에는 개인키가 필요합니다'],
  '请填写代币合约地址': ['Enter a token contract address', 'トークンアドレスを入力してください', '토큰 컨트랙트 주소를 입력하세요'],
  '查余额需要填写私钥': ['Balance check needs a private key', '残高照会には秘密鍵が必要です', '잔액 조회에는 개인키가 필요합니다'],
  '请填写代币地址、接收地址和数量': ['Enter token, recipient and amount', 'トークン・受取先・数量を入力してください', '토큰·수신자·수량을 입력하세요'],
  '请填写代币地址和授权数量': ['Enter token address and amount', 'トークンアドレスと数量を入力してください', '토큰 주소와 수량을 입력하세요'],
  '请填写代币地址和 spender': ['Enter token address and spender', 'トークンアドレスと spender を入力してください', '토큰 주소와 spender를 입력하세요'],
  '无法读取代币 decimals': ["Can't read token decimals", 'トークンの decimals を読めません', '토큰 decimals를 읽을 수 없습니다'],
  '查询 allowance 需要填写私钥（用于确定 owner）': ['Allowance check needs a private key (to derive the owner)', 'allowance 照会には秘密鍵が必要です（owner の特定用）', 'allowance 조회에는 개인키가 필요합니다 (owner 확인용)'],
  '请填写消息和私钥': ['Enter a message and private key', 'メッセージと秘密鍵を入力してください', '메시지와 개인키를 입력하세요'],
  '请填写消息、签名和地址': ['Enter message, signature and address', 'メッセージ・署名・アドレスを入力してください', '메시지·서명·주소를 입력하세요'],
  '请填写账户名、私钥和密码': ['Enter account name, key and password', 'アカウント名・秘密鍵・パスワードを入力してください', '계정명·개인키·비밀번호를 입력하세요'],
  '至少保留一个网络': ['Keep at least one network', '少なくとも 1 つのネットワークが必要です', '최소 하나의 네트워크는 유지해야 합니다'],
  '名称和 RPC 必填': ['Name and RPC are required', '名称と RPC は必須です', '이름과 RPC는 필수입니다'],
  '网络已添加': ['Network added', 'ネットワークを追加しました', '네트워크 추가됨'],
  '已保存': ['Saved', '保存しました', '저장됨'],
  'Anvil 已启动': ['Anvil started', 'Anvil を起動しました', 'Anvil 시작됨'],
  '请在上方填写签名账户': ['Fill in the signer above', '上の署名アカウントを入力してください', '위의 서명 계정을 입력하세요'],
  '没有无参读函数': ['No zero-arg read functions', '引数なしの読み取り関数がありません', '무인자 읽기 함수가 없습니다'],
  '请先创建快照': ['Create a snapshot first', 'まずスナップショットを作成してください', '먼저 스냅샷을 생성하세요'],
  '请填写要模拟的地址': ['Enter an address to impersonate', '偽装するアドレスを入力してください', '가장할 주소를 입력하세요'],
  '请填写地址和余额': ['Enter an address and balance', 'アドレスと残高を入力してください', '주소와 잔액을 입력하세요'],
  '余额格式不正确': ['Invalid balance', '残高の形式が不正です', '잔액 형식이 잘못되었습니다'],
  '挖块数量必须是整数': ['Block count must be an integer', 'ブロック数は整数で指定してください', '블록 수는 정수여야 합니다'],
  '请填写快进秒数': ['Enter seconds to warp', '進める秒数を入力してください', '앞당길 초를 입력하세요'],
  '地址和事件签名至少填一个': ['Enter an address or event signature', 'アドレスかイベントシグネチャを入力してください', '주소나 이벤트 시그니처 중 하나를 입력하세요'],
  '✓ 有效的 Foundry 项目': ['✓ valid Foundry project', '✓ 有効な Foundry プロジェクト', '✓ 유효한 Foundry 프로젝트'],
  '{0} 个合约': ['{0} contracts', '{0} 個のコントラクト', '컨트랙트 {0}개'],
  '已构建': ['built', 'ビルド済み', '빌드됨'],
  '未构建': ['not built', '未ビルド', '빌드 안 됨'],
  '未找到 foundry.toml': ['foundry.toml not found', 'foundry.toml が見つかりません', 'foundry.toml을 찾을 수 없음'],
  '[进程结束，退出码 {0}]': ['[process exited with code {0}]', '[プロセス終了・コード {0}]', '[프로세스 종료, 코드 {0}]'],
  '[构建成功]': ['[build succeeded]', '[ビルド成功]', '[빌드 성공]'],
  '[构建失败]': ['[build failed]', '[ビルド失敗]', '[빌드 실패]'],
  '[部署成功]': ['[deploy succeeded]', '[デプロイ成功]', '[배포 성공]'],
  '[模拟成功]': ['[simulation succeeded]', '[シミュレーション成功]', '[시뮬레이션 성공]'],
  '[部署失败，退出码 {0}]': ['[deploy failed, exit code {0}]', '[デプロイ失敗・コード {0}]', '[배포 실패, 코드 {0}]'],
  '部署成功 ✓': ['deployed ✓', 'デプロイ成功 ✓', '배포 성공 ✓'],
  '合约地址：': ['Contract: ', 'コントラクト：', '컨트랙트: '],
  '交易哈希：': ['Tx hash: ', 'Tx ハッシュ：', 'Tx 해시: '],
  '在区块浏览器中查看 ↗': ['View on explorer ↗', 'エクスプローラで表示 ↗', '익스플로러에서 보기 ↗'],
  '模拟执行通过 ✓ — 合约可以部署。点击「🚀 部署合约」正式发送交易。': ['Simulation passed ✓ — ready to deploy. Click "🚀 Deploy" to send for real.', 'シミュレーション成功 ✓ — デプロイ可能です。「🚀 デプロイ」で本番送信。', '시뮬레이션 통과 ✓ — 배포 가능합니다. 「🚀 배포」로 실제 전송하세요.'],
  '[脚本广播执行成功]': ['[script broadcast succeeded]', '[スクリプト実行成功（ブロードキャスト）]', '[스크립트 브로드캐스트 성공]'],
  '[脚本模拟执行成功]': ['[script simulation succeeded]', '[スクリプトシミュレーション成功]', '[스크립트 시뮬레이션 성공]'],
  '[脚本执行失败，退出码 {0}]': ['[script failed, exit code {0}]', '[スクリプト失敗・コード {0}]', '[스크립트 실패, 코드 {0}]'],
  '脚本执行成功 ✓（{0} 笔交易已上链）': ['script succeeded ✓ ({0} txs on-chain)', 'スクリプト成功 ✓（{0} 件の Tx がオンチェーン）', '스크립트 성공 ✓ ({0}건 온체인)'],
  '部署': ['Deploy', 'デプロイ', '배포'],
  '模拟执行通过 ✓{0}。点击「🚀 广播执行」正式上链。': ['Simulation passed ✓{0}. Click "🚀 Broadcast" to go on-chain.', 'シミュレーション成功 ✓{0}。「🚀 ブロードキャスト」で本番送信。', '시뮬레이션 통과 ✓{0}. 「🚀 브로드캐스트」로 온체인 전송하세요.'],
  ' — 将部署：{0}': [' — will deploy: {0}', ' — デプロイ予定：{0}', ' — 배포 예정: {0}'],
  '转账成功 ✓': ['Transfer succeeded ✓', '送金成功 ✓', '전송 성공 ✓'],
  '代币转账成功 ✓': ['Token transfer succeeded ✓', 'トークン送金成功 ✓', '토큰 전송 성공 ✓'],
  '交易已上链但执行失败（reverted）': ['Tx mined but reverted', 'Tx はマイニングされましたが失敗しました（reverted）', 'Tx는 채굴됐지만 실행 실패 (reverted)'],
  '哈希：': ['Hash: ', 'ハッシュ：', '해시: '],
  '授权成功 ✓（{0}）': ['Approved ✓ ({0})', '承認成功 ✓（{0}）', '승인 성공 ✓ ({0})'],
  '无限额度': ['unlimited', '無制限', '무제한'],
  '∞ 无限授权': ['∞ unlimited allowance', '∞ 無制限承認', '∞ 무제한 승인'],
  '交易成功 ✓': ['Tx succeeded ✓', 'Tx 成功 ✓', 'Tx 성공 ✓'],
  '预计 gas: {0}': ['Estimated gas: {0}', '推定 gas：{0}', '예상 가스: {0}'],
  'ERC-20': ['ERC-20', 'ERC-20', 'ERC-20'],
  '合约写入': ['Write', '書き込み', '쓰기'],
  'Raw 调用': ['Raw call', 'Raw 呼び出し', 'Raw 호출'],
  '脚本部署': ['Script deploy', 'スクリプト', '스크립트 배포'],
  '工作台': ['Workbench', 'ワークベンチ', '워크벤치'],
  '（暂无 keystore 账户）': ['(no keystore accounts)', '（Keystore アカウントなし）', '(Keystore 계정 없음)'],
  '0x （该地址不是合约 / 无代码）': ['0x (not a contract / no code)', '0x（コントラクトではありません / コードなし）', '0x (컨트랙트 아님 / 코드 없음)'],
  '[anvil 已退出，退出码 {0}]': ['[anvil exited with code {0}]', '[anvil 終了・コード {0}]', '[anvil 종료, 코드 {0}]'],
  '✓ 已挖 {0} 个区块': ['✓ mined {0} blocks', '✓ {0} ブロックをマイニング', '✓ {0}개 블록 채굴됨'],
  '✓ 时间已快进 {0} 秒并挖出 1 个区块': ['✓ warped {0}s and mined 1 block', '✓ {0} 秒進めて 1 ブロックをマイニング', '✓ {0}초 진행 후 1개 블록 채굴'],
  '✓ 快照已创建，ID {0}': ['✓ snapshot created, ID {0}', '✓ スナップショット作成・ID {0}', '✓ 스냅샷 생성됨, ID {0}'],
  '快照 {0}（区块 {1}）': ['snapshot {0} (block {1})', 'スナップショット {0}（ブロック {1}）', '스냅샷 {0} (블록 {1})'],
  '✓ 已回滚到快照 {0}（该快照及之后的快照已失效）': ['✓ reverted to snapshot {0} (it and later snapshots are now consumed)', '✓ スナップショット {0} に復元（以降のスナップショットは無効）', '✓ 스냅샷 {0}으로 되돌림 (이후 스냅샷은 무효화)'],
  '回滚失败：快照不存在或已被使用': ['Revert failed: snapshot missing or already used', '復元失敗：スナップショットが存在しないか使用済み', '되돌리기 실패: 스냅샷이 없거나 이미 사용됨'],
  '✓ {0} 余额已设为 {1} ETH': ['✓ {0} balance set to {1} ETH', '✓ {0} の残高を {1} ETH に設定', '✓ {0} 잔액을 {1} ETH로 설정'],
  '✓ 已开启 impersonate：{0}（发交易时用 --from 该地址 --unlocked）': ['✓ impersonating {0} (send with --from <addr> --unlocked)', '✓ impersonate 有効：{0}（--from アドレス --unlocked で送信）', '✓ impersonate 활성화: {0} (--from 주소 --unlocked로 전송)'],
  '✓ 已停止 impersonate：{0}': ['✓ stopped impersonating {0}', '✓ impersonate 停止：{0}', '✓ impersonate 중지: {0}'],
  '[会话已结束]': ['[session ended]', '[セッション終了]', '[세션 종료]'],
  '正在启动 chisel…': ['starting chisel…', 'chisel を起動中…', 'chisel 시작 중…'],
  '[完成，退出码 {0}]': ['[done, exit code {0}]', '[完了・コード {0}]', '[완료, 코드 {0}]'],
  '[完成]': ['[done]', '[完了]', '[완료]'],
  '（未查询到日志 — 可尝试调整区块范围）': ['(no logs found — try a different block range)', '（ログなし — ブロック範囲を調整してください）', '(로그 없음 — 블록 범위를 조정해 보세요)'],
  '读 {0}': ['read {0}', '読み {0}', '읽기 {0}'],
  '写 {0}': ['write {0}', '書き {0}', '쓰기 {0}'],
  '{0} 个': ['{0}', '{0} 個', '{0}개'],
  '读取失败': ['read failed', '読み取り失敗', '읽기 실패'],
  '(空)': ['(empty)', '(空)', '(비어 있음)'],
  '(无输出)': ['(no output)', '(出力なし)', '(출력 없음)'],
  '(失败)': ['(failed)', '(失敗)', '(실패)'],
  '未找到编译产物 — 请先在「项目构建」页执行 Build': ['No artifacts found — run Build on the Build & Test page first', '成果物が見つかりません — まず「ビルド & テスト」で Build を実行してください', '아티팩트 없음 — 먼저 「빌드 & 테스트」에서 Build를 실행하세요'],
  '数量格式不正确（最多 {0} 位小数）': ['Invalid amount (max {0} decimals)', '数量が不正です（小数は最大 {0} 桁）', '수량 형식 오류 (소수 최대 {0}자리)'],
  '请填写参数 {0}': ['Fill in parameter {0}', 'パラメータ {0} を入力してください', '매개변수 {0}을(를) 입력하세요'],
  '查询失败：该地址可能不是 ERC-20 合约（{0}）': ['Lookup failed: probably not an ERC-20 contract ({0})', '照会失敗：ERC-20 コントラクトではない可能性があります（{0}）', '조회 실패: ERC-20 컨트랙트가 아닐 수 있습니다 ({0})'],
  '✓ {0} ({1}) · decimals: {2}': ['✓ {0} ({1}) · decimals: {2}', '✓ {0}（{1}）· decimals: {2}', '✓ {0} ({1}) · decimals: {2}'],
  'Keystore 账户「{0}」（发送时使用）': ['Keystore account "{0}" (used when sending)', 'Keystore アカウント「{0}」（送信時に使用）', 'Keystore 계정 「{0}」 (전송 시 사용)'],
  '请先填写私钥或账户名': ['Enter a private key or account name first', 'まず秘密鍵かアカウント名を入力してください', '먼저 개인키나 계정명을 입력하세요'],
  '内部错误: {0}': ['Internal error: {0}', '内部エラー: {0}', '내부 오류: {0}'],
  '进程数已达上限（{0}），请先停止部分任务': ['Process limit reached ({0}) — stop some tasks first', 'プロセス数が上限（{0}）に達しました', '프로세스 한도({0}) 도달 — 일부 작업을 중지하세요'],
  '未找到编译产物 — 点击「先构建」后可自动解析构造函数参数；也可以直接在下方手动填写。': ['No artifacts found — click "Build first" to auto-parse constructor args, or fill them in manually below.', '成果物が見つかりません — 「先にビルド」でコンストラクタ引数を自動解析するか、下に手動入力してください。', '아티팩트 없음 — 「먼저 빌드」로 생성자 인자를 자동 해석하거나 아래에 직접 입력하세요.'],
  '该合约无构造函数参数。': ['This contract has no constructor arguments.', 'このコントラクトにはコンストラクタ引数がありません。', '이 컨트랙트에는 생성자 인자가 없습니다.'],
  '构造函数参数': ['Constructor arguments', 'コンストラクタ引数', '생성자 인자'],
  '构造函数参数（空格分隔，可留空）': ['Constructor args (space-separated, optional)', 'コンストラクタ引数（スペース区切り・省略可）', '생성자 인자 (공백 구분, 선택)'],
  '数量：': ['Amount: ', '数量：', '수량: '],
  '（raw: {0}）': [' (raw: {0})', '（raw: {0}）', ' (raw: {0})'],
  '粘贴的 ABI': ['pasted ABI', '貼り付けた ABI', '붙여넣은 ABI'],
  'JSON 解析失败：{0}': ['JSON parse failed: {0}', 'JSON 解析エラー：{0}', 'JSON 파싱 실패: {0}'],
  '未找到 ABI 数组（支持纯数组或含 abi 字段的 artifact）': ['No ABI array found (bare array or artifact with an abi field)', 'ABI 配列が見つかりません（配列または abi フィールド付き artifact）', 'ABI 배열을 찾을 수 없음 (배열 또는 abi 필드가 있는 artifact)'],
  '无法读取代币 decimals，请先点击「查询代币」确认合约有效': ["Can't read token decimals — click \"Fetch token\" to verify the contract first", 'トークンの decimals を読めません — 「トークン照会」で確認してください', '토큰 decimals를 읽을 수 없음 — 「토큰 조회」로 먼저 확인하세요'],
};
