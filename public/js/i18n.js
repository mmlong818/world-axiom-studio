export const SUPPORTED_LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja'];

export const TERMINOLOGY = {
  product: { 'zh-CN': '铸界', 'zh-TW': '鑄界', en: 'Zhujie', ja: '鋳界' },
  worldBook: { 'zh-CN': '世界之书', 'zh-TW': '世界之書', en: 'World Book', ja: 'ワールドブック' },
  worldCanon: { 'zh-CN': '世界正典', 'zh-TW': '世界正典', en: 'World Canon', ja: 'ワールド・カノン' },
  flowersInTheMirror: { 'zh-CN': '《镜花缘》', 'zh-TW': '《鏡花緣》', en: 'Flowers in the Mirror', ja: '『鏡花縁』' },
};

const rows = [
  ['铸界 · 世界观生成工作台', '鑄界 · 世界觀生成工作台', 'Zhujie · Worldbuilding Studio', '鋳界 · 世界観構築スタジオ'],
  ['铸界', '鑄界', 'Zhujie', '鋳界'],
  ['界面与输出语言', '介面與輸出語言', 'Interface and output language', '画面と出力の言語'],
  ['铸界世界库', '鑄界世界庫', 'Zhujie world library', '鋳界ワールドライブラリ'], ['世界库概况', '世界庫概況', 'World library overview', 'ワールドライブラリ概要'], ['打开模型设置', '開啟模型設定', 'Open model settings', 'モデル設定を開く'], ['Claude CLI（本机订阅）', 'Claude CLI（本機訂閱）', 'Claude CLI (local subscription)', 'Claude CLI（ローカル契約）'],
  ['跳到主要内容', '跳到主要內容', 'Skip to main content', 'メインコンテンツへ移動'],
  ['依据', '依據', 'Source', '素材'], ['研究', '研究', 'Research', 'リサーチ'], ['方向', '方向', 'Directions', '方向性'], ['世界', '世界', 'World', '世界'], ['发布', '發佈', 'Publish', '公開'],
  ['世界保存在本机', '世界儲存在本機', 'Worlds stay on this device', '世界はこの端末に保存'], ['密钥只存当前浏览器', '金鑰只存在目前瀏覽器', 'Keys stay in this browser', 'キーはこのブラウザ内のみ'],
  ['模型与接口', '模型與介面', 'Models & API', 'モデルとAPI'], ['返回', '返回', 'Back', '戻る'], ['返回世界库', '返回世界庫', 'Back to library', 'ライブラリへ戻る'],
  ['新世界 · 尚未命名', '新世界 · 尚未命名', 'New world · Untitled', '新しい世界 · 名称未定'], ['真实模型', '真實模型', 'Live model', '実モデル'],
  ['铸造只属于你的', '鑄造只屬於你的', 'Forge a world that is', 'あなただけの'], ['世界观。', '世界觀。', 'yours alone.', '世界観を鋳造する。'],
  ['本系统由 云一工作室\u00a0开发维护。', '本系統由 雲一工作室\u00a0開發維護。', 'Developed and maintained by Yunyi Studio.', '雲一スタジオが開発・保守しています。'],
  ['从一句灵感或一本书开始。创造新世界，也可以还原并延续熟悉的世界；每个世界都会独立保存生成进度、审计结果和下一步任务。', '從一句靈感或一本書開始。創造新世界，也可以還原並延續熟悉的世界；每個世界都會獨立儲存生成進度、稽核結果和下一步任務。', 'Start with a single idea or a book. Create something new, or reconstruct and extend a world you know. Each world keeps its own progress, review results, and next tasks.', 'ひとつの着想や一冊の本から始めます。新しい世界を創ることも、既存の世界を再現して発展させることもできます。進捗・監査結果・次の作業は世界ごとに保存されます。'],
  ['新建空白世界', '新增空白世界', 'New blank world', '空の世界を作成'], ['我的世界', '我的世界', 'My worlds', 'マイワールド'], ['世界归档后，才允许永久删除。', '世界封存後，才允許永久刪除。', 'A world can be permanently deleted only after it is archived.', '完全削除できるのは、アーカイブした世界だけです。'],
  ['搜索世界、题材或任务', '搜尋世界、題材或任務', 'Search worlds, genres, or tasks', '世界・ジャンル・タスクを検索'], ['搜索世界', '搜尋世界', 'Search worlds', '世界を検索'],
  ['个进行中的世界', '個進行中的世界', 'active worlds', '件の進行中'], ['个已归档世界', '個已封存世界', 'archived worlds', '件のアーカイブ'], ['项待推进任务', '項待推進任務', 'open tasks', '件の未完了タスク'], ['项任务', '項任務', 'tasks', '件のタスク'], ['草稿', '草稿', 'Draft', '下書き'], ['生成中', '生成中', 'Generating', '生成中'], ['可交付', '可交付', 'Ready', '完成'], ['进行中', '進行中', 'In progress', '進行中'], ['新世界', '新世界', 'New world', '新しい世界'],
  ['筛选谱系', '篩選類型', 'Filter family', '系統で絞り込み'], ['筛选状态', '篩選狀態', 'Filter status', '状態で絞り込み'], ['进行中的世界', '進行中的世界', 'Active worlds', '進行中の世界'], ['已归档', '已封存', 'Archived', 'アーカイブ済み'], ['全部世界', '全部世界', 'All worlds', 'すべての世界'],
  ['起点 · 世界依据', '起點 · 世界依據', 'Starting point · Sources', '出発点 · 世界の素材'],
  ['系统先生成三个可读的世界概述供你选择，再解释世界如何运转、地方怎样联系、历史为何形成今天，以及人们怎样生活，最终编成可阅读、可查阅的世界之书。故事不是起点，只是完成后的应用之一。', '系統會先生成三個易讀的世界概述供你選擇，再解釋世界如何運轉、地方如何相連、歷史為何形成今日，以及人們如何生活，最終編成可閱讀、可查閱的世界之書。故事不是起點，只是完成後的應用之一。', 'First choose from three concise ways to present the world. Zhujie then explains how it works, how places connect, how history shaped the present, and how people live—finally compiling a readable, searchable World Book. A story is one possible use of the finished world, not the starting point.', 'まず、世界をどう紹介するかを示す3つの短い案から選びます。その後、世界の仕組み、土地のつながり、現在を形作った歴史、人々の暮らしを段階的に説明し、読めて検索できるワールドブックにまとめます。物語は完成後の用途のひとつであり、出発点ではありません。'],
  ['简要说明', '簡要說明', 'Brief', '簡単な説明'], ['上传一本书', '上傳一本書', 'Upload a book', '本をアップロード'], ['素材类型', '素材類型', 'Source type', '素材の種類'],
  ['描述世界，或输入一本书、影视、游戏等已有作品的名称', '描述世界，或輸入一本書、影視、遊戲等既有作品的名稱', 'Describe a world, or enter the title of an existing book, film, series, or game', '世界を説明するか、書籍・映画・ドラマ・ゲームなど既存作品のタイトルを入力'],
  ['例如：这是一个被永久云层覆盖的海洋星球；也可以输入《镜花缘》，或说明希望把两部作品的世界构造方式进行原创融合。', '例如：這是一顆被永久雲層覆蓋的海洋星球；也可以輸入《鏡花緣》，或說明希望把兩部作品的世界構造方式進行原創融合。', 'For example: An ocean planet hidden beneath permanent cloud cover. You can also enter Flowers in the Mirror, or ask for an original fusion of two existing worlds.', '例：永遠に雲に覆われた海洋惑星。『鏡花縁』のような作品名や、2作品の世界をもとに独自の融合を作りたいという要望も入力できます。'],
  ['单部作品会先还原再补足；多部作品会确定主世界、次世界和时空接入点，保留原著名称与事件连续性。', '單部作品會先還原再補足；多部作品會確定主世界、次世界和時空接入點，保留原著名稱與事件連續性。', 'A single work is reconstructed before it is extended. For multiple works, Zhujie identifies the primary world, supporting worlds, and a time-space entry point while preserving canonical names and event continuity.', '単一作品はまず原作を再現し、不足部分だけを補います。複数作品では主世界・副世界・時空上の接続点を定め、原作の固有名詞と出来事の連続性を守ります。'],
  ['拖入或选择一本书', '拖入或選擇一本書', 'Drop or choose a book', '本をドロップまたは選択'], ['先复现故事经历、人物、地方、风物与事件；资料不足处才会明确标注并扩展，不复制原文表达。', '先復現故事經歷、人物、地方、風物與事件；資料不足處才會明確標示並擴展，不複製原文表達。', 'Reconstruct the plot, characters, places, customs, and events first. Gaps are clearly marked before extension; the source wording is not copied.', 'まず物語、人物、場所、風物、出来事を再現します。資料の不足は明示してから補完し、原文固有の表現は複製しません。'],
  ['要还原哪些范围？', '要還原哪些範圍？', 'What should be reconstructed?', 'どの範囲を再現しますか？'], ['移除书籍', '移除書籍', 'Remove book', '書籍を削除'],
  ['使用目的', '使用目的', 'Intended use', '用途'], ['世界之书', '世界之書', 'World Book', 'ワールドブック'], ['小说', '小說', 'Novel', '小説'], ['游戏', '遊戲', 'Game', 'ゲーム'], ['影视', '影視', 'Film / TV', '映像作品'], ['研究整理', '研究整理', 'Research notes', '調査整理'],
  ['世界范围', '世界範圍', 'World scope', '世界の範囲'], ['交给系统', '交給系統', 'Let Zhujie decide', '鋳界に任せる'], ['单一场所', '單一場所', 'Single location', 'ひとつの場所'], ['聚落或街区', '聚落或街區', 'Settlement or district', '集落・街区'], ['城市与周边', '城市與周邊', 'City and surroundings', '都市と周辺'], ['区域或国家', '區域或國家', 'Region or country', '地域・国家'], ['大陆或整颗星球', '大陸或整顆星球', 'Continent or planet', '大陸・惑星全体'], ['多星球或多位面', '多星球或多位面', 'Multiple planets or planes', '複数惑星・複数次元'], ['指需要解释清楚的范围，不是故事镜头。', '指需要解釋清楚的範圍，不是故事鏡頭。', 'This is the area the World Book must explain, not the camera range of a story.', '説明すべき世界の範囲であり、物語の視野の広さではありません。'],
  ['文字气质', '文字氣質', 'Writing tone', '文章の雰囲気'], ['自动判断', '自動判斷', 'Automatic', '自動判定'], ['明亮而有代价', '明亮但有代價', 'Hopeful, with a cost', '明るいが代償がある'], ['克制现实', '克制寫實', 'Restrained and realistic', '抑制の効いた現実調'], ['神秘幽微', '神祕幽微', 'Subtle and mysterious', '繊細で神秘的'], ['黑暗沉重', '黑暗沉重', 'Dark and heavy', '暗く重い'], ['荒诞讽刺', '荒誕諷刺', 'Absurd and satirical', '不条理で風刺的'], ['史诗庄严', '史詩莊嚴', 'Epic and solemn', '荘厳な叙事詩調'],
  ['填入一个示例', '填入一個範例', 'Use an example', '例を入力'], ['研究并生成 3 个世界方向', '研究並生成 3 個世界方向', 'Research and create 3 directions', '調査して3つの方向性を作成'],
  ['研究 · 回到故事发生的地方', '研究 · 回到故事發生的地方', 'Research · Return to the story', '調査 · 物語の現場へ戻る'], ['先看材料讲了什么，', '先看材料說了什麼，', 'Understand the source first.', '素材を理解してから、'], ['再决定怎样创造。', '再決定如何創造。', 'Then decide what to create.', '何を創るか決める。'],
  ['这里先整理故事经历、人物与群体、地方风物、民风日常和关键事件。规则只在后续用于解释世界，不能代替故事本身。', '這裡先整理故事經歷、人物與群體、地方風物、民風日常和關鍵事件。規則只在後續用於解釋世界，不能取代故事本身。', 'This stage organizes the plot, characters and peoples, places and customs, everyday life, and key events. Rules are used later to explain the world; they cannot replace the story itself.', 'ここでは物語の経緯、人物と集団、土地と風物、暮らし、重要な出来事を整理します。ルールは後で世界を説明するために使い、物語そのものの代わりにはしません。'],
  ['重新研究', '重新研究', 'Run research again', '再調査'], ['根据这份研究生成 3 个方向', '根據這份研究生成 3 個方向', 'Create 3 directions from this research', 'この調査から3案を作成'], ['任务简报', '任務簡報', 'Task brief', 'タスク概要'],
  ['故事概况', '故事概況', 'Story overview', '物語の概要'], ['故事怎样带读者进入世界', '故事如何帶讀者進入世界', 'How the story reveals its world', '物語が世界をどう見せるか'], ['问题与回答', '問題與回答', 'Questions & answers', '問いと回答'], ['这次研究实际解决了什么', '這次研究實際解決了什麼', 'What this research established', '今回の調査で分かったこと'],
  ['原作情节总线', '原作情節主線', 'Source plot line', '原作の物語線'], ['从开端到结局发生了什么', '從開端到結局發生了什麼', 'What happens from beginning to end', '始まりから結末までに起きたこと'], ['故事中的世界', '故事中的世界', 'The world in the story', '物語の中の世界'], ['人物、地方与风物', '人物、地方與風物', 'People, places, and customs', '人物・場所・風物'], ['关键事件', '關鍵事件', 'Key events', '重要な出来事'], ['哪些事情改变了人物与世界', '哪些事情改變了人物與世界', 'Events that changed people and the world', '人物と世界を変えた出来事'], ['资料来源', '資料來源', 'Sources', '資料出典'], ['本次实际读取的材料', '本次實際讀取的材料', 'Materials actually read', '実際に参照した資料'], ['边界与缺口', '邊界與缺口', 'Boundaries & gaps', '境界と不足'], ['不应被伪装成事实的内容', '不應被偽裝成事實的內容', 'What must not be presented as fact', '事実として扱ってはいけない内容'],
  ['候选 · 三种呈现方向', '候選 · 三種呈現方向', 'Candidates · Three presentation directions', '候補 · 3つの見せ方'], ['先决定怎样介绍，\n再开始建立世界。', '先決定如何介紹，\n再開始建立世界。', 'Decide how to present it.\nThen build the world.', 'どう紹介するかを決めてから、\n世界を構築する。'], ['每个方向只有约 200 字，说明准备从什么视角和哪些材料进入这个世界。地域、族群、民风、历史与制度会在选定方向后逐步构建。', '每個方向只有約 200 字，說明準備從什麼視角和哪些材料進入這個世界。地域、族群、民風、歷史與制度會在選定方向後逐步構建。', 'Each direction is a short introduction explaining its viewpoint and the source material it will carry forward. Places, peoples, customs, history, and institutions are built step by step after you choose.', '各案は約200字の短い紹介で、どの視点と素材から世界に入るかを示します。地域、民族、風俗、歴史、制度は、案を選んだ後に段階的に構築します。'], ['重新建模', '重新建模', 'Create new directions', '方向性を作り直す'],
  ['分步构建 · 每一步由你确认', '分步構建 · 每一步由你確認', 'Step-by-step build · You approve each stage', '段階構築 · 各段階で確認'], ['世界正在被解释清楚', '世界正在被解釋清楚', 'Making the world understandable', '世界を明確に説明しています'], ['世界基础拆成定位、规律与地方、历史与社会、日常与条目 4 步；每次只生成一部分。你可以阅读、修改或重做，确认后的版本才会进入下一步。', '世界基礎拆成定位、規律與地方、歷史與社會、日常與條目 4 步；每次只生成一部分。你可以閱讀、修改或重做，確認後的版本才會進入下一步。', 'The foundations are built in four stages: identity, rules and places, history and society, then daily life and entries. Read, edit, or regenerate each part; only an approved version feeds the next stage.', '世界の基礎を、位置づけ、法則と場所、歴史と社会、日常と項目の4段階に分けます。各段階を読み、編集し、作り直せます。確認した内容だけが次の段階に渡ります。'],
  ['从中断处继续', '從中斷處繼續', 'Resume', '中断箇所から再開'], ['实时草稿', '即時草稿', 'Live draft', 'リアルタイム草稿'], ['等待模型返回文字', '等待模型返回文字', 'Waiting for model output', 'モデルの出力を待っています'], ['待审核', '待審核', 'Awaiting review', '確認待ち'], ['审核当前步骤', '審核目前步驟', 'Review this stage', '現在の段階を確認'], ['确认后才会生成下一步。', '確認後才會生成下一步。', 'The next stage starts only after approval.', '確認後に次の段階を生成します。'], ['阅读预览', '閱讀預覽', 'Reading view', '閲覧表示'], ['修改 Markdown', '修改 Markdown', 'Edit Markdown', 'Markdownを編集'], ['重新生成本步骤', '重新生成本步驟', 'Regenerate this stage', 'この段階を再生成'], ['确认并生成下一步', '確認並生成下一步', 'Approve and generate next', '確認して次を生成'],
  ['世界正典', '世界正典', 'World Canon', 'ワールド・カノン'], ['后续正文唯一可用的事实底稿', '後續正文唯一可用的事實底稿', 'The sole factual basis for later writing', '後続本文が参照する唯一の事実基盤'], ['已经确认的世界内容', '已經確認的世界內容', 'Approved world content', '確認済みの世界内容'], ['后续生成只会读取已确认版本', '後續生成只會讀取已確認版本', 'Later generation reads approved versions only', '以降は確認済み版だけを参照します'],
  ['审计 · 找出站不住的地方', '稽核 · 找出站不住腳的地方', 'Review · Find what does not hold up', '監査 · 成立しない点を探す'], ['只拦真正的矛盾，', '只攔真正的矛盾，', 'Block real contradictions,', '止めるのは本当の矛盾だけ。'], ['不拿建议反复打扰。', '不拿建議反覆打擾。', 'not optional improvements.', '提案で繰り返し邪魔しない。'], ['重新审计', '重新稽核', 'Run review again', '再監査'], ['必须处理的矛盾', '必須處理的矛盾', 'Contradictions to resolve', '解決必須の矛盾'], ['可选改进建议', '可選改進建議', 'Optional improvements', '任意の改善案'], ['接受当前版本并完成', '接受目前版本並完成', 'Accept this version and finish', '現在の版を採用して完了'], ['让 AI 修补关键矛盾', '讓 AI 修補關鍵矛盾', 'Let AI fix key contradictions', 'AIで重要な矛盾を修正'],
  ['世界之书 · 两种阅读密度', '世界之書 · 兩種閱讀密度', 'World Book · Two reading depths', 'ワールドブック · 2つの読み方'], ['一部世界，两种打开方式', '一個世界，兩種開啟方式', 'One world, two ways to read', 'ひとつの世界、2つの読み方'], ['世界之书 Wiki', '世界之書 Wiki', 'World Book Wiki', 'ワールドブック Wiki'], ['世界概览', '世界概覽', 'World overview', '世界の概要'], ['世界模型数据', '世界模型資料', 'World model data', '世界モデルデータ'], ['独立 HTML，可检索、可离线打开', '獨立 HTML，可檢索、可離線開啟', 'Standalone HTML, searchable and offline', '単体HTML・検索可能・オフライン対応'], ['Markdown，3 分钟读完', 'Markdown，3 分鐘讀完', 'Markdown, a 3-minute read', 'Markdown・3分で読める概要'], ['JSON，保留因果链、来源层与交叉引用', 'JSON，保留因果鏈、來源層與交叉引用', 'JSON with causality, sources, and cross-references', '因果・出典・相互参照を保持するJSON'],
  ['世界详情', '世界詳情', 'World details', '世界の詳細'], ['追加世界任务', '追加世界任務', 'Add a world task', '世界タスクを追加'], ['归档世界', '封存世界', 'Archive world', '世界をアーカイブ'], ['永久删除', '永久刪除', 'Delete permanently', '完全に削除'], ['恢复世界', '恢復世界', 'Restore world', '世界を復元'], ['继续这个世界', '繼續這個世界', 'Continue this world', 'この世界を続ける'], ['取消', '取消', 'Cancel', 'キャンセル'],
  ['关闭世界详情', '關閉世界詳情', 'Close world details', '世界の詳細を閉じる'], ['构建方式', '構建方式', 'Build mode', '構築方法'], ['创造新世界', '創造新世界', 'Create a new world', '新しい世界を創る'], ['还原已有世界', '還原既有世界', 'Reconstruct an existing world', '既存世界を再現'], ['原著连续性扩展', '原著連續性擴展', 'Source-continuity extension', '原作の連続性を保つ拡張'], ['当前状态', '目前狀態', 'Current status', '現在の状態'], ['最近更新', '最近更新', 'Last updated', '最終更新'], ['世界任务', '世界任務', 'World tasks', '世界タスク'], ['例如：补足普通人的一周', '例如：補足普通人的一週', 'For example: complete an ordinary person’s week', '例：普通の人の一週間を補う'], ['内容', '內容', 'Content', '内容'], ['结构', '結構', 'Structure', '構造'], ['审计', '稽核', 'Review', '監査'], ['试玩', '試玩', 'Playtest', 'プレイテスト'], ['加入', '加入', 'Add', '追加'], ['待推进', '待推進', 'Open', '未完了'], ['完成', '完成', 'Done', '完了'],
  ['连接账号、读取该账号真正可用的模型，再用一条极短请求验证。通过后才会保存启用。', '連接帳號、讀取該帳號真正可用的模型，再用一條極短請求驗證。通過後才會儲存啟用。', 'Connect an account, load the models it can actually use, then verify with a very short request. Settings are saved only after the test passes.', 'アカウントに接続して実際に利用できるモデルを読み込み、短いリクエストで検証します。合格後にだけ保存・有効化します。'], ['连接账号', '連接帳號', 'Connect account', 'アカウント接続'], ['选择模型', '選擇模型', 'Choose model', 'モデル選択'], ['验证并启用', '驗證並啟用', 'Verify & enable', '検証して有効化'], ['服务商', '服務商', 'Provider', 'プロバイダー'], ['接口标准', '介面標準', 'API protocol', 'API規格'], ['API 端点', 'API 端點', 'API endpoint', 'APIエンドポイント'], ['读取可用模型', '讀取可用模型', 'Load available models', '利用可能なモデルを取得'], ['尚未读取模型列表', '尚未讀取模型列表', 'Model list not loaded', 'モデル一覧は未取得です'], ['先读取模型列表…', '先讀取模型列表…', 'Load the model list first…', '先にモデル一覧を取得…'], ['手动填写完整模型名', '手動填寫完整模型名稱', 'Enter a model ID manually', 'モデルIDを手動入力'], ['完整模型名', '完整模型名稱', 'Full model ID', '完全なモデルID'], ['测试并修正配置', '測試並修正設定', 'Test and correct settings', '接続テストと設定修正'], ['等待连接', '等待連接', 'Waiting to connect', '接続待ち'], ['填写密钥，或选择 Claude CLI。', '填寫金鑰，或選擇 Claude CLI。', 'Enter a key or choose Claude CLI.', 'キーを入力するか、Claude CLIを選択してください。'], ['高级生成设置', '進階生成設定', 'Advanced generation settings', '高度な生成設定'], ['创意强度', '創意強度', 'Creativity', '創造性'], ['清除本机密钥', '清除本機金鑰', 'Clear saved keys', '保存済みキーを消去'], ['保存并启用', '儲存並啟用', 'Save & enable', '保存して有効化'], ['本地服务已连接', '本機服務已連接', 'Local service connected', 'ローカルサービス接続済み'],
  ['关闭设置', '關閉設定', 'Close settings', '設定を閉じる'], ['模型设置进度', '模型設定進度', 'Model setup progress', 'モデル設定の進捗'], ['使用本机 Claude Code 登录额度', '使用本機 Claude Code 登入額度', 'Use the local Claude Code subscription', 'ローカルのClaude Code契約を使用'], ['将检查安装、登录和订阅状态，不读取或复制登录凭证。', '將檢查安裝、登入和訂閱狀態，不讀取或複製登入憑證。', 'Checks installation, sign-in, and subscription status without reading or copying credentials.', 'インストール、ログイン、契約状態を確認します。認証情報は読み取りも複製もしません。'], ['已包含完整官方别名、百万上下文入口和本机自定义映射；也可直接输入完整模型名，最终权限以连接测试为准。', '已包含完整官方別名、百萬上下文入口和本機自訂映射；也可直接輸入完整模型名稱，最終權限以連接測試為準。', 'Includes official aliases, million-context entries, and local custom mappings. You can also enter a full model ID; actual access is verified by the connection test.', '公式エイリアス、100万コンテキスト用エントリ、ローカル設定のモデルを含みます。完全なモデルIDも入力できます。利用可否は接続テストで確認します。'], ['会发送一条极短测试请求，可能计入少量 API 或 Claude CLI 额度。', '會傳送一條極短測試請求，可能計入少量 API 或 Claude CLI 額度。', 'Sends one very short test request, which may use a small amount of API or Claude CLI quota.', 'ごく短いテストを1件送信します。少量のAPIまたはClaude CLI枠を使用する場合があります。'], ['当前连接已启用', '目前連接已啟用', 'Current connection enabled', '現在の接続は有効です'], ['密钥只保存在当前设备的这个浏览器中，不会写入源码、日志、世界存档、导出文件或远端仓库。', '金鑰只儲存在目前裝置的這個瀏覽器中，不會寫入原始碼、日誌、世界存檔、匯出檔案或遠端儲存庫。', 'Keys stay in this browser on this device. They are never written to source code, logs, world archives, exports, or remote repositories.', 'キーはこの端末のブラウザ内だけに保存され、ソースコード、ログ、世界データ、エクスポート、リモートリポジトリには書き込まれません。'], ['智谱 GLM', '智譜 GLM', 'Zhipu GLM', 'Zhipu GLM'], ['通义千问', '通義千問', 'Alibaba Qwen', 'Alibaba Qwen'], ['豆包', '豆包', 'Doubao', 'Doubao'], ['自定义兼容端点', '自訂相容端點', 'Custom compatible endpoint', 'カスタム互換エンドポイント'],
  ['正在建立世界模型', '正在建立世界模型', 'Building the world model', '世界モデルを構築中'], ['模型处理中', '模型處理中', 'Model working', 'モデル処理中'], ['正在准备本轮生成', '正在準備本輪生成', 'Preparing this generation', '今回の生成を準備中'], ['操作进度', '操作進度', 'Progress', '進捗'], ['正在构建这个世界', '正在構建這個世界', 'Building this world', 'この世界を構築中'], ['等待选择世界模型', '等待選擇世界模型', 'Waiting for a direction', '方向性の選択待ち'],
  ['一眼看懂', '一眼看懂', 'At a glance', 'ひと目で分かる'], ['如何运转', '如何運轉', 'How it works', '仕組み'], ['地方与关系', '地方與關係', 'Places & connections', '場所と関係'], ['历史为何如此', '歷史為何如此', 'How history shaped it', '歴史が形作ったもの'], ['人们怎样生活', '人們如何生活', 'How people live', '人々の暮らし'], ['重要名称', '重要名稱', 'Essential names', '重要な名称'], ['世界之书目录', '世界之書目錄', 'World Book contents', 'ワールドブック目次'], ['世界命题', '世界命題', 'World premise', '世界の前提'], ['历史范围', '歷史範圍', 'Historical scope', '歴史範囲'], ['证据状态', '證據狀態', 'Evidence status', '根拠の状態'], ['一致性审计', '一致性稽核', 'Consistency review', '整合性監査'], ['原著承接与扩展', '原著承接與擴展', 'Source continuity & extensions', '原作の継承と拡張'], ['本次生成使用的公开资料', '本次生成使用的公開資料', 'Public sources used in this build', '今回の生成で使用した公開資料'], ['主世界：', '主世界：', 'Primary world:', '主世界：'], ['次世界：', '次世界：', 'Supporting world:', '副世界：'], ['时空接入：', '時空接入：', 'Time-space entry:', '時空上の接続：'], ['扩展理由：', '擴展理由：', 'Reason for extension:', '拡張理由：'],
  ['世界前提、整体面貌与最关键差异', '世界前提、整體面貌與最關鍵差異', 'Premise, overall shape, and defining difference', '前提・全体像・最も重要な違い'], ['关键规律以及它们造成的日常后果', '關鍵規律以及它們造成的日常後果', 'Core rules and their everyday consequences', '主要な法則と日常への影響'], ['主要地方及交通、资源与权力联系', '主要地方及交通、資源與權力聯繫', 'Key places and their links through travel, resources, and power', '主要な場所と交通・資源・権力のつながり'], ['改变当下的转折及仍可见的后果', '改變當下的轉折及仍可見的後果', 'Turning points that shaped the present and their visible effects', '現在を形作った転換点と残る影響'], ['社会、生计与普通人的一天', '社會、生計與普通人的一天', 'Society, livelihoods, and an ordinary day', '社会・生業・普通の一日'], ['理解世界不可缺少的少量条目与索引', '理解世界不可缺少的少量條目與索引', 'A concise index of essential names', '世界を理解するための重要項目と索引'], ['先理解整体，再逐步进入运转方式、地方、历史与生活；最后只保留必要条目供查阅。', '先理解整體，再逐步進入運轉方式、地方、歷史與生活；最後只保留必要條目供查閱。', 'Start with the whole, then move through its workings, places, history, and daily life. The final section keeps only the entries needed for reference.', '全体像から始め、仕組み、場所、歴史、暮らしへ進みます。最後に参照に必要な項目だけをまとめます。'],
  ['来源分层', '來源分層', 'Source layers', '出典レイヤー'], ['成书路径', '成書路徑', 'Book structure', '構成の流れ'], ['原文／明确事实', '原文／明確事實', 'Source / explicit fact', '原文・明示された事実'], ['可追溯推断', '可追溯推斷', 'Traceable inference', '追跡可能な推論'], ['争议并列', '爭議並列', 'Conflicting accounts', '異説の併記'], ['新增设计隔离', '新增設計隔離', 'New design kept separate', '新規設定を分離'], ['未知保留', '未知保留', 'Unknown kept open', '不明点を保留'], ['概览', '概覽', 'Overview', '概要'], ['运转', '運轉', 'Workings', '仕組み'], ['地方', '地方', 'Places', '場所'], ['历史', '歷史', 'History', '歴史'], ['生活', '生活', 'Daily life', '暮らし'], ['名称', '名稱', 'Names', '名称'],
  ['公开资料来源', '公開資料來源', 'Public sources', '公開資料の出典'], ['先复现原著的故事、人物、地方、风物与事件；只有资料不足时才在明确边界内扩展。', '先復現原著的故事、人物、地方、風物與事件；只有資料不足時才在明確邊界內擴展。', 'The source plot, characters, places, customs, and events are reconstructed first. Extensions are added only where evidence runs out, within a clearly marked boundary.', '原作の物語、人物、場所、風物、出来事を先に再現します。資料が不足する部分だけを、境界を明示して拡張します。'], ['原著保留', '原著保留', 'Preserved from source', '原作を保持'], ['原著延续', '原著延續', 'Source continuity', '原作を継承'], ['时空融合', '時空融合', 'Time-space fusion', '時空融合'], ['沿用原著时空', '沿用原著時空', 'Source timeline retained', '原作の時空を継承'], ['世界介绍', '世界介紹', 'World introduction', '世界紹介'], ['尚无定论', '尚無定論', 'Undetermined', '未確定'], ['范围未定', '範圍未定', 'Scope not set', '範囲未定'], ['原著还原', '原著還原', 'Source reconstruction', '原作再現'], ['原著优先 · 缺口扩展', '原著優先 · 缺口擴展', 'Source first · gaps extended', '原作優先・不足を拡張'], ['原创模型', '原創模型', 'Original world', 'オリジナル世界'], ['世界观', '世界觀', 'world', '世界観'], ['结构数据', '結構資料', 'structured-data', '構造データ'],
];

const indexByLocale = { 'zh-CN': 0, 'zh-TW': 1, en: 2, ja: 3 };
const catalog = Object.fromEntries(SUPPORTED_LOCALES.map((locale) => [locale, new Map(rows.map((row) => [row[0], row[indexByLocale[locale]]]))]));
const LOCALE_KEY = 'zhujie-locale-v1';

export function normalizeLocale(locale) {
  return SUPPORTED_LOCALES.includes(locale) ? locale : 'zh-CN';
}

export function getLocale() {
  if (typeof localStorage === 'undefined') return 'zh-CN';
  return normalizeLocale(localStorage.getItem(LOCALE_KEY));
}

export function setLocale(locale) {
  const normalized = normalizeLocale(locale);
  if (typeof localStorage !== 'undefined') localStorage.setItem(LOCALE_KEY, normalized);
  return normalized;
}

export function localeTerm(term, locale = getLocale()) {
  return TERMINOLOGY[term]?.[normalizeLocale(locale)] ?? term;
}

export function t(source, locale = getLocale()) {
  const value = String(source ?? '');
  return catalog[normalizeLocale(locale)].get(value) ?? value;
}

const countPatterns = {
  'zh-TW': [
    [/^(\d+) 个结果$/, '$1 個結果'], [/^(\d+) 项$/, '$1 項'], [/^已等待 (\d+) 秒$/, '已等待 $1 秒'],
    [/^(\d+)\/(\d+) 项任务$/, '$1/$2 項任務'],
    [/^已读取 ([\d,]+) 个模型$/, '已讀取 $1 個模型'], [/^已接收 ([\d,]+) 字符$/, '已接收 $1 個字元'],
    [/^本地服务 (.+) 已连接$/, '本機服務 $1 已連接'], [/^(.+) 已在 (.+) 通过连接测试。$/, '$1 已於 $2 通過連接測試。'],
  ],
  en: [
    [/^(\d+) 个结果$/, '$1 results'], [/^(\d+) 项$/, '$1 items'], [/^已等待 (\d+) 秒$/, 'Waiting $1 sec'],
    [/^(\d+)\/(\d+) 项任务$/, '$1/$2 tasks'],
    [/^已读取 ([\d,]+) 个模型$/, '$1 models loaded'], [/^已接收 ([\d,]+) 字符$/, '$1 characters received'],
    [/^(\d+) 个进行中的世界$/, '$1 active worlds'], [/^(\d+) 个已归档世界$/, '$1 archived worlds'], [/^(\d+) 项待推进任务$/, '$1 open tasks'],
    [/^本地服务 (.+) 已连接$/, 'Local service $1 connected'], [/^(.+) 已在 (.+) 通过连接测试。$/, '$1 passed the connection test at $2.'],
  ],
  ja: [
    [/^(\d+) 个结果$/, '$1件'], [/^(\d+) 项$/, '$1件'], [/^已等待 (\d+) 秒$/, '$1秒経過'],
    [/^(\d+)\/(\d+) 项任务$/, '$1/$2件のタスク'],
    [/^已读取 ([\d,]+) 个模型$/, '$1件のモデルを取得'], [/^已接收 ([\d,]+) 字符$/, '$1文字を受信'],
    [/^(\d+) 个进行中的世界$/, '進行中 $1件'], [/^(\d+) 个已归档世界$/, 'アーカイブ $1件'], [/^(\d+) 项待推进任务$/, '未完了タスク $1件'],
    [/^本地服务 (.+) 已连接$/, 'ローカルサービス $1 接続済み'], [/^(.+) 已在 (.+) 通过连接测试。$/, '$1 は $2 に接続テスト済みです。'],
  ],
};

export function localizeText(source, locale = getLocale()) {
  const normalized = normalizeLocale(locale);
  const value = String(source ?? '');
  const direct = t(value, normalized);
  if (direct !== value) return direct;
  for (const [pattern, replacement] of countPatterns[normalized] ?? []) {
    if (pattern.test(value)) return value.replace(pattern, replacement);
  }
  return value;
}

function translateTextNode(node, locale) {
  if (!node?.parentElement || node.parentElement.closest('[data-i18n-ignore],script,style,textarea')) return;
  const source = node.nodeValue;
  const trimmed = source.trim();
  if (!trimmed) return;
  const translated = localizeText(trimmed, locale);
  if (translated !== trimmed) {
    if (node.parentElement.tagName === 'OPTION' && !node.parentElement.hasAttribute('value')) node.parentElement.setAttribute('value', trimmed);
    node.nodeValue = source.replace(trimmed, translated);
  }
}

function translateElement(element, locale) {
  if (!(element instanceof Element) || element.closest('[data-i18n-ignore]')) return;
  for (const attribute of ['aria-label', 'placeholder', 'title']) {
    const source = element.getAttribute(attribute);
    if (source) element.setAttribute(attribute, localizeText(source, locale));
  }
  for (const node of element.childNodes) if (node.nodeType === Node.TEXT_NODE) translateTextNode(node, locale);
  for (const child of element.querySelectorAll('*')) {
    for (const attribute of ['aria-label', 'placeholder', 'title']) {
      const source = child.getAttribute(attribute);
      if (source) child.setAttribute(attribute, localizeText(source, locale));
    }
    for (const node of child.childNodes) if (node.nodeType === Node.TEXT_NODE) translateTextNode(node, locale);
  }
}

export function initI18n() {
  const locale = getLocale();
  document.documentElement.lang = locale;
  document.title = t('铸界 · 世界观生成工作台', locale);
  const selector = document.querySelector('#languageSelect');
  if (selector) {
    selector.value = locale;
    selector.addEventListener('change', () => {
      setLocale(selector.value);
      window.location.reload();
    });
  }
  if (locale === 'zh-CN') return;
  translateElement(document.body, locale);
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.TEXT_NODE) translateTextNode(node, locale);
        else if (node.nodeType === Node.ELEMENT_NODE) translateElement(node, locale);
      }
      if (mutation.type === 'characterData') translateTextNode(mutation.target, locale);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}
