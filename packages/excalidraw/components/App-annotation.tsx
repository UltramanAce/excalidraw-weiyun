// 引入 React 和相关的 hooks 用于构建组件和使用上下文
import React, { useContext } from "react";

// flushSync 用于确保 React 更新是同步的
import { flushSync } from "react-dom";

// 导入粗糙图形库，用于绘制非平滑的图形
import type { RoughCanvas } from "roughjs/bin/canvas";
import rough from "roughjs/bin/rough";

// 用于动态添加 CSS 类名，方便构建 className 字符串
import clsx from "clsx";

// nanoid 是一个轻量的唯一 ID 生成器
import { nanoid } from "nanoid";

// 导入不同的用户操作动作（如复制、删除、撤销等）
// 这些动作通常是用户与画布交互时触发的
import {
  actionAddToLibrary,
  actionBringForward,
  actionBringToFront,
  actionCopy,
  actionCopyAsPng,
  actionCopyAsSvg,
  copyText,
  actionCopyStyles,
  actionCut,
  actionDeleteSelected,
  actionDuplicateSelection,
  actionFinalize,
  actionFlipHorizontal,
  actionFlipVertical,
  actionGroup,
  actionPasteStyles,
  actionSelectAll,
  actionSendBackward,
  actionSendToBack,
  actionToggleGridMode,
  actionToggleStats,
  actionToggleZenMode,
  actionUnbindText,
  actionBindText,
  actionUngroup,
  actionLink,
  actionToggleElementLock,
  actionToggleLinearEditor,
  actionToggleObjectsSnapMode,
  actionToggleCropEditor,
} from "../actions";

// 导入与撤销和重做操作相关的函数
import { createRedoAction, createUndoAction } from "../actions/actionHistory";

// ActionManager 用于管理用户在画布上的操作（例如执行、撤销、重做）
import { ActionManager } from "../actions/manager";

// actions 是一个包含所有动作的注册表
import { actions } from "../actions/register";

// 导入与应用状态相关的类型定义
import type { Action, ActionResult } from "../actions/types";

// 用于分析的工具函数，追踪用户的事件（例如点击、操作）
import { trackEvent } from "../analytics";

// 导入获取和判断当前应用状态的工具函数
import {
  getDefaultAppState,
  isEraserActive,  // 判断橡皮擦工具是否激活
  isHandToolActive,  // 判断手工具是否激活
} from "../appState";

// 导入与剪贴板操作相关的类型和函数
import type { PastedMixedContent } from "../clipboard";
import { copyTextToSystemClipboard, parseClipboard } from "../clipboard";

// 导入常量和工具函数，这些常量在应用中用于配置和处理不同的行为
import { ARROW_TYPE, isSafari, type EXPORT_IMAGE_TYPES } from "../constants";
import {
  APP_NAME,  // 应用名称
  CURSOR_TYPE,  // 鼠标指针类型
  DEFAULT_MAX_IMAGE_WIDTH_OR_HEIGHT,  // 默认图像最大宽高
  DEFAULT_VERTICAL_ALIGN,  // 默认垂直对齐方式
  DRAGGING_THRESHOLD,  // 拖拽的阈值
  ELEMENT_SHIFT_TRANSLATE_AMOUNT,  // 元素平移的步长
  ELEMENT_TRANSLATE_AMOUNT,  // 元素的平移量
  ENV,  // 环境设置
  EVENT,  // 事件常量
  FRAME_STYLE,  // 框架样式
  IMAGE_MIME_TYPES,  // 支持的图片 MIME 类型
  IMAGE_RENDER_TIMEOUT,  // 图像渲染超时设置
  isBrave,  // 判断是否为 Brave 浏览器
  LINE_CONFIRM_THRESHOLD,  // 线条确认的阈值
  MAX_ALLOWED_FILE_BYTES,  // 最大文件大小限制
  MIME_TYPES,  // MIME 类型定义
  MQ_MAX_HEIGHT_LANDSCAPE,  // 横屏最大高度
  MQ_MAX_WIDTH_LANDSCAPE,  // 横屏最大宽度
  MQ_MAX_WIDTH_PORTRAIT,  // 竖屏最大宽度
  MQ_RIGHT_SIDEBAR_MIN_WIDTH,  // 右侧边栏的最小宽度
  POINTER_BUTTON,  // 鼠标按钮类型
  ROUNDNESS,  // 圆角度数
  SCROLL_TIMEOUT,  // 滚动超时时间
  TAP_TWICE_TIMEOUT,  // 双击超时设置
  TEXT_TO_CENTER_SNAP_THRESHOLD,  // 文字居中对齐的阈值
  THEME,  // 主题设置（如暗黑模式、亮模式）
  THEME_FILTER,  // 主题滤镜
  TOUCH_CTX_MENU_TIMEOUT,  // 触摸右键菜单超时
  VERTICAL_ALIGN,  // 垂直对齐方式
  YOUTUBE_STATES,  // YouTube 状态定义
  ZOOM_STEP,  // 缩放步长
  POINTER_EVENTS,  // 指针事件定义
  TOOL_TYPE,  // 工具类型（例如画笔、橡皮擦等）
  isIOS,  // 判断是否为 iOS 操作系统
  supportsResizeObserver,  // 判断浏览器是否支持 ResizeObserver
  DEFAULT_COLLISION_THRESHOLD,  // 默认碰撞检测阈值
  DEFAULT_TEXT_ALIGN,  // 默认文字对齐方式
} from "../constants";

// 导入与画布数据相关的模块，用于导出、恢复和操作数据
import type { ExportedElements } from "../data";  // 导出的元素类型
import { exportCanvas, loadFromBlob } from "../data";  // 画布导出和从 Blob 加载数据
import Library, { distributeLibraryItemsOnSquareGrid } from "../data/library";  // 库操作和分布
import { restore, restoreElements } from "../data/restore";  // 数据恢复函数

// 导入用于操作元素的函数：
// 包括创建新元素、拖动元素、调整元素大小、计算元素尺寸等操作
import {
  dragNewElement,  // 拖动创建的新元素
  dragSelectedElements,  // 拖动已选择的元素
  duplicateElement,  // 复制单个元素
  getCommonBounds,  // 获取多个元素的公共边界
  getCursorForResizingElement,  // 获取用于调整大小的光标类型
  getDragOffsetXY,  // 获取拖动时的偏移量
  getElementWithTransformHandleType,  // 获取变换控件类型
  getNormalizedDimensions,  // 获取元素的标准化尺寸
  getResizeArrowDirection,  // 获取调整大小箭头的方向
  getResizeOffsetXY,  // 获取调整大小时的偏移量
  getLockedLinearCursorAlignSize,  // 获取锁定线性元素的对齐尺寸
  getTransformHandleTypeFromCoords,  // 从坐标获取变换控件类型
  isInvisiblySmallElement,  // 判断元素是否过小不可见
  isNonDeletedElement,  // 判断元素是否未删除
  isTextElement,  // 判断元素是否为文本元素
  newElement,  // 创建新的元素
  newLinearElement,  // 创建新的线性元素
  newTextElement,  // 创建新的文本元素
  newImageElement,  // 创建新的图像元素
  transformElements,  // 执行元素变换
  refreshTextDimensions,  // 刷新文本元素的尺寸
  redrawTextBoundingBox,  // 重新绘制文本元素的边框
  getElementAbsoluteCoords,  // 获取元素的绝对坐标
} from "../element";

// 导入与元素绑定相关的操作函数：
// 用于处理线性元素的绑定与解绑，更新绑定信息，处理绑定错误等
import {
  bindOrUnbindLinearElement,  // 绑定或解绑线性元素
  bindOrUnbindLinearElements,  // 批量绑定或解绑线性元素
  fixBindingsAfterDeletion,  // 删除后修复绑定
  fixBindingsAfterDuplication,  // 复制后修复绑定
  getHoveredElementForBinding,  // 获取悬浮元素用于绑定
  isBindingEnabled,  // 判断绑定是否启用
  isLinearElementSimpleAndAlreadyBound,  // 判断线性元素是否简单且已绑定
  maybeBindLinearElement,  // 可能会绑定线性元素
  shouldEnableBindingForPointerEvent,  // 判断是否应为指针事件启用绑定
  updateBoundElements,  // 更新绑定的元素
  getSuggestedBindingsForArrows,  // 获取箭头元素的建议绑定
} from "../element/binding";

// 导入与线性元素编辑器相关的模块：
// 提供线性元素的编辑和操作功能
import { LinearElementEditor } from "../element/linearElementEditor";

// 导入元素操作相关的函数：
// 包括深拷贝、复制、创建新类型元素等
import { mutateElement, newElementWith } from "../element/mutateElement";
import {
  deepCopyElement,  // 深拷贝元素
  duplicateElements,  // 复制多个元素
  newFrameElement,  // 创建新的框架元素
  newFreeDrawElement,  // 创建自由绘制元素
  newEmbeddableElement,  // 创建可嵌入的元素
  newMagicFrameElement,  // 创建魔术框架元素
  newIframeElement,  // 创建 iframe 元素
  newArrowElement,  // 创建箭头元素
} from "../element/newElement";

// 导入类型检查函数：
// 用于判断元素的类型，如箭头元素、绑定元素、图像元素等
import {
  hasBoundTextElement,  // 判断是否绑定了文本元素
  isArrowElement,  // 判断元素是否为箭头元素
  isBindingElement,  // 判断元素是否为绑定元素
  isBindingElementType,  // 判断元素是否为绑定元素类型
  isBoundToContainer,  // 判断元素是否绑定到容器
  isFrameLikeElement,  // 判断元素是否像框架元素
  isImageElement,  // 判断元素是否为图像元素
  isEmbeddableElement,  // 判断元素是否可嵌入
  isInitializedImageElement,  // 判断元素是否为初始化的图像元素
  isLinearElement,  // 判断元素是否为线性元素
  isLinearElementType,  // 判断元素是否为线性元素类型
  isUsingAdaptiveRadius,  // 判断元素是否使用自适应半径
  isIframeElement,  // 判断元素是否为 iframe 元素
  isIframeLikeElement,  // 判断元素是否像 iframe 元素
  isMagicFrameElement,  // 判断元素是否为魔术框架元素
  isTextBindableContainer,  // 判断元素是否为可绑定文本的容器
  isElbowArrow,  // 判断元素是否为弯头箭头
  isFlowchartNodeElement,  // 判断元素是否为流程图节点元素
} from "../element/typeChecks";

// 导入各种元素类型的定义：
// 定义了多种不同类型的元素及其相关属性
import type {
  ExcalidrawBindableElement,  // 可绑定元素类型
  ExcalidrawElement,  // 基础元素类型
  ExcalidrawFreeDrawElement,  // 自由绘制元素类型
  ExcalidrawGenericElement,  // 通用元素类型
  ExcalidrawLinearElement,  // 线性元素类型
  ExcalidrawTextElement,  // 文本元素类型
  NonDeleted,  // 未删除元素类型
  InitializedExcalidrawImageElement,  // 已初始化的图像元素
  ExcalidrawImageElement,  // 图像元素类型
  FileId,  // 文件 ID 类型
  NonDeletedExcalidrawElement,  // 未删除的元素类型
  ExcalidrawTextContainer,  // 文本容器类型
  ExcalidrawFrameLikeElement,  // 类似框架元素类型
  ExcalidrawMagicFrameElement,  // 魔术框架元素类型
  ExcalidrawIframeLikeElement,  // 类似 iframe 元素类型
  IframeData,  // iframe 数据类型
  ExcalidrawIframeElement,  // iframe 元素类型
  ExcalidrawEmbeddableElement,  // 可嵌入的元素类型
  Ordered,  // 有序类型
  MagicGenerationData,  // 魔术生成数据类型
  ExcalidrawNonSelectionElement,  // 非选择元素类型
  ExcalidrawArrowElement,  // 箭头元素类型
  NonDeletedSceneElementsMap,  // 未删除场景元素的映射
} from "../element/types";

// 导入手势操作相关函数
// 用于处理与手势相关的操作，例如获取中心点和计算距离
import { getCenter, getDistance } from "../gesture";

// 导入与元素分组操作相关的函数
// 用于操作和管理元素的分组，判断元素是否在分组中，选择分组等
import {
  editGroupForSelectedElement,  // 编辑选中元素所在的分组
  getElementsInGroup,  // 获取分组中的所有元素
  getSelectedGroupIdForElement,  // 获取选中元素的分组ID
  getSelectedGroupIds,  // 获取所有选中元素的分组ID
  isElementInGroup,  // 判断元素是否属于某个分组
  isSelectedViaGroup,  // 判断元素是否通过分组选中
  selectGroupsForSelectedElements,  // 选择选中元素所属的分组
} from "../groups";

// 导入历史记录相关模块
// 用于管理编辑历史，支持撤销、重做等功能
import { History } from "../history";

// 导入国际化相关模块
// 提供语言支持、语言设置、翻译等功能
import { defaultLang, getLanguage, languages, setLanguage, t } from "../i18n";

// 导入键盘操作相关常量和函数
// 用于处理键盘输入和快捷键等操作
import {
  CODES,  // 键盘按键的代码映射
  shouldResizeFromCenter,  // 判断是否应该从中心调整大小
  shouldMaintainAspectRatio,  // 判断是否应该保持宽高比
  shouldRotateWithDiscreteAngle,  // 判断是否应该以离散角度旋转
  isArrowKey,  // 判断按下的是否是箭头键
  KEYS,  // 键盘快捷键的常量
} from "../keys";

// 导入与元素尺寸和视图相关的辅助函数
// 用于计算元素是否完全在视口中，元素的可见性等
import {
  isElementCompletelyInViewport,  // 判断元素是否完全在视口内
  isElementInViewport,  // 判断元素是否在视口内
} from "../element/sizeHelpers";

// 导入与场景和视图相关的操作函数
// 用于获取场景元素、视口缩放、选中元素等操作
import {
  calculateScrollCenter,  // 计算滚动视图的中心位置
  getElementsWithinSelection,  // 获取选区内的元素
  getNormalizedZoom,  // 获取标准化的缩放比例
  getSelectedElements,  // 获取当前选中的元素
  hasBackground,  // 判断是否存在背景
  isSomeElementSelected,  // 判断是否有元素被选中
} from "../scene";

// 导入场景类
// 用于管理和渲染整个绘图场景
import Scene from "../scene/Scene";

// 导入场景类型定义
// 定义了场景相关的回调、滚动条等类型
import type {
  RenderInteractiveSceneCallback,  // 渲染交互式场景的回调
  ScrollBars,  // 场景的滚动条类型
} from "../scene/types";

// 导入与场景缩放相关的函数
// 用于获取缩放状态和调整场景的缩放级别
import { getStateForZoom } from "../scene/zoom";

// 导入与形状相关的操作函数
// 提供与形状有关的计算、获取等功能
import {
  findShapeByKey,  // 通过键查找形状
  getBoundTextShape,  // 获取绑定文本的形状
  getCornerRadius,  // 获取形状的圆角半径
  getElementShape,  // 获取元素的形状
  isPathALoop,  // 判断路径是否为闭合路径
} from "../shapes";

// 导入几何图形的工具函数
// 用于获取选择框的形状，判断点是否在形状内等
import { getSelectionBoxShape } from "../../utils/geometry/shape";
import { isPointInShape } from "../../utils/collision";

// 导入全局类型定义
// 包含应用程序相关的各种类型定义，帮助类型检查与补全
import type {
  AppClassProperties,  // 应用类的属性类型
  AppProps,  // 应用组件的属性类型
  AppState,  // 应用状态类型
  BinaryFileData,  // 二进制文件数据类型
  DataURL,  // 数据 URL 类型
  ExcalidrawImperativeAPI,  // Excalidraw API 类型
  BinaryFiles,  // 二进制文件集合类型
  Gesture,  // 手势事件类型
  GestureEvent,  // 手势事件类型
  LibraryItems,  // 库项类型
  PointerDownState,  // 按下鼠标时的状态类型
  SceneData,  // 场景数据类型
  Device,  // 设备类型
  FrameNameBoundsCache,  // 帧名称边界缓存类型
  SidebarName,  // 侧边栏名称类型
  SidebarTabName,  // 侧边栏标签名称类型
  KeyboardModifiersObject,  // 键盘修饰符对象类型
  CollaboratorPointer,  // 协作者指针类型
  ToolType,  // 工具类型
  OnUserFollowedPayload,  // 用户跟随的回调负载类型
  UnsubscribeCallback,  // 取消订阅回调类型
  EmbedsValidationStatus,  // 嵌入元素的验证状态类型
  ElementsPendingErasure,  // 待删除元素集合类型
  GenerateDiagramToCode,  // 生成代码的图表类型
  NullableGridSize,  // 可空的网格大小类型
  Offsets,  // 偏移量类型
} from "../types";

// 导入各种工具函数
// 提供了不同的工具函数，如防抖、计算距离、更新对象、获取快捷键等
import {
  debounce,  // 防抖函数
  distance,  // 计算两点之间的距离
  getFontString,  // 获取字体字符串
  getNearestScrollableContainer,  // 获取最近的可滚动容器
  isInputLike,  // 判断是否像输入框
  isToolIcon,  // 判断是否为工具图标
  isWritableElement,  // 判断元素是否可写
  sceneCoordsToViewportCoords,  // 场景坐标转视口坐标
  tupleToCoors,  // 将元组转换为坐标
  viewportCoordsToSceneCoords,  // 视口坐标转场景坐标
  wrapEvent,  // 包装事件
  updateObject,  // 更新对象的属性
  updateActiveTool,  // 更新当前激活的工具
  getShortcutKey,  // 获取快捷键
  isTransparent,  // 判断元素是否透明
  easeToValuesRAF,  // 使用请求动画帧逐渐过渡到目标值
  muteFSAbortError,  // 忽略文件系统的错误
  isTestEnv,  // 判断是否在测试环境中
  easeOut,  // 缓动函数（加速后减速）
  updateStable,  // 更新稳定状态
  addEventListener,  // 添加事件监听器
  normalizeEOL,  // 标准化换行符
  getDateTime,  // 获取当前日期和时间
  isShallowEqual,  // 判断两个对象是否浅相等
  arrayToMap,  // 将数组转换为映射
  toBrandedType,  // 转换为品牌类型
} from "../utils";

// 引入与嵌入式内容相关的工具函数
import {
  createSrcDoc,  // 创建嵌入式内容的srcDoc
  embeddableURLValidator,  // 验证可嵌入内容的URL是否合法
  maybeParseEmbedSrc,  // 尝试解析嵌入内容的源
  getEmbedLink,  // 获取嵌入式链接
} from "../element/embeddable";

// 引入上下文菜单相关功能
import type { ContextMenuItems } from "./ContextMenu";  // 上下文菜单项的类型定义
import { ContextMenu, CONTEXT_MENU_SEPARATOR } from "./ContextMenu";  // 上下文菜单组件和分隔符
import LayerUI from "./LayerUI";  // 图层 UI 组件
import { Toast } from "./Toast";  // 提示框组件

// 引入视图模式切换的 action
import { actionToggleViewMode } from "../actions/actionToggleViewMode";

// 引入数据处理和文件处理相关工具
import {
  dataURLToFile,  // 将 data URL 转换为文件
  dataURLToString,  // 将 data URL 转换为字符串
  generateIdFromFile,  // 从文件生成唯一 ID
  getDataURL,  // 获取 data URL
  getDataURL_sync,  // 同步获取 data URL
  getFileFromEvent,  // 从事件获取文件
  ImageURLToFile,  // 将图像 URL 转换为文件
  isImageFileHandle,  // 判断是否为图像文件句柄
  isSupportedImageFile,  // 判断是否为支持的图像文件类型
  loadSceneOrLibraryFromBlob,  // 从 Blob 加载场景或库
  normalizeFile,  // 规范化文件
  parseLibraryJSON,  // 解析库的 JSON
  resizeImageFile,  // 调整图像文件的大小
  SVGStringToFile,  // 将 SVG 字符串转换为文件
} from "../data/blob";

// 引入与图像元素和图像缓存相关的操作
import {
  getInitializedImageElements,  // 获取初始化的图像元素
  loadHTMLImageElement,  // 加载 HTML 图像元素
  normalizeSVG,  // 规范化 SVG 格式
  updateImageCache as _updateImageCache,  // 更新图像缓存
} from "../element/image";

// 引入节流功能（用来控制某些函数的调用频率）
import throttle from "lodash.throttle";

// 引入文件系统相关功能
import type { FileSystemHandle } from "../data/filesystem";  // 文件系统句柄类型
import { fileOpen } from "../data/filesystem";  // 打开文件操作

// 引入与文本元素和排版相关的工具
import {
  bindTextToShapeAfterDuplication,  // 在复制后将文本绑定到形状
  getApproxMinLineHeight,  // 获取大致的最小行高
  getApproxMinLineWidth,  // 获取大致的最小行宽
  getBoundTextElement,  // 获取绑定的文本元素
  getContainerCenter,  // 获取容器的中心
  getContainerElement,  // 获取容器元素
  getLineHeightInPx,  // 获取行高（以像素为单位）
  getMinTextElementWidth,  // 获取最小文本元素宽度
  isMeasureTextSupported,  // 判断是否支持文本测量
  isValidTextContainer,  // 判断是否为有效的文本容器
  measureText,  // 测量文本的尺寸
  normalizeText,  // 规范化文本
} from "../element/textElement";

// 引入与超链接操作相关的工具
import {
  showHyperlinkTooltip,  // 显示超链接提示框
  hideHyperlinkToolip,  // 隐藏超链接提示框
  Hyperlink,  // 超链接组件
} from "../components/hyperlink/Hyperlink";

// 引入与 URL 处理相关的工具
import { isLocalLink, normalizeLink, toValidURL } from "../data/url";  // 处理本地链接、规范化链接、转换为有效 URL

// 引入与元素变换（拖动、缩放）相关的功能
import { shouldShowBoundingBox } from "../element/transformHandles";  // 判断是否显示边界框

// 引入与元素锁定相关的操作
import { actionUnlockAllElements } from "../actions/actionElementLock";

// 引入与字体和行高计算相关的工具
import { Fonts, getLineHeight } from "../fonts";

// 引入与帧管理和元素框架相关的功能
import {
  getFrameChildren,  // 获取帧的子元素
  isCursorInFrame,  // 判断光标是否在帧内
  bindElementsToFramesAfterDuplication,  // 复制后将元素绑定到帧
  addElementsToFrame,  // 将元素添加到帧
  replaceAllElementsInFrame,  // 替换帧内的所有元素
  removeElementsFromFrame,  // 从帧中移除元素
  getElementsInResizingFrame,  // 获取正在调整大小的帧中的元素
  getElementsInNewFrame,  // 获取新帧中的元素
  getContainingFrame,  // 获取包含该元素的帧
  elementOverlapsWithFrame,  // 判断元素是否与帧重叠
  updateFrameMembershipOfSelectedElements,  // 更新选中元素的帧归属
  isElementInFrame,  // 判断元素是否在帧内
  getFrameLikeTitle,  // 获取类似帧的标题
  getElementsOverlappingFrame,  // 获取与帧重叠的元素
  filterElementsEligibleAsFrameChildren,  // 过滤可作为帧子元素的元素
} from "../frame";

// 引入与场景选择和元素选择相关的工具
import {
  excludeElementsInFramesFromSelection,  // 从选择中排除帧内的元素
  makeNextSelectedElementIds,  // 生成下一个选中元素的 ID
} from "../scene/selection";

// 引入与剪贴板相关的操作
import { actionPaste } from "../actions/actionClipboard";

// 引入与帧元素操作相关的功能
import {
  actionRemoveAllElementsFromFrame,  // 从帧中移除所有元素
  actionSelectAllElementsInFrame,  // 选择帧中的所有元素
} from "../actions/actionFrame";

// 引入与画布工具相关的操作
import { actionToggleHandTool, zoomToFit } from "../actions/actionCanvas";

// 引入与状态管理相关的工具
import { jotaiStore } from "../jotai";  // jotai 状态管理

// 引入与确认对话框相关的状态
import { activeConfirmDialogAtom } from "./ActiveConfirmDialog";

// 引入与错误相关的模块
import { ImageSceneDataError } from "../errors";

// 引入与吸附（Snap）功能相关的工具
import {
  getSnapLinesAtPointer,  // 获取指针位置的吸附线
  snapDraggedElements,  // 吸附拖动的元素
  isActiveToolNonLinearSnappable,  // 判断当前工具是否支持非线性吸附
  snapNewElement,  // 吸附新元素
  snapResizingElements,  // 吸附正在调整大小的元素
  isSnappingEnabled,  // 判断是否启用吸附
  getVisibleGaps,  // 获取可见的间隙
  getReferenceSnapPoints,  // 获取参考吸附点
  SnapCache,  // 吸附缓存
  isGridModeEnabled,  // 判断网格模式是否启用
  getGridPoint,  // 获取网格点
} from "../snapping";

// 导入各种操作相关的动作、组件、类型等
import { actionWrapTextInContainer } from "../actions/actionBoundText"; // 用于包装文本到容器的动作
import BraveMeasureTextError from "./BraveMeasureTextError"; // 处理文本度量错误的组件
import { activeEyeDropperAtom } from "./EyeDropper"; // 当前激活的吸管工具的原子状态
import type { ExcalidrawElementSkeleton } from "../data/transform"; // 引入数据转换相关的类型
import { convertToExcalidrawElements } from "../data/transform"; // 将数据转换为 Excalidraw 元素
import type { ValueOf } from "../utility-types"; // 引入工具类型，用于提取某个类型的值
import { isSidebarDockedAtom } from "./Sidebar/Sidebar"; // 判断侧边栏是否停靠的原子状态
import { StaticCanvas, InteractiveCanvas } from "./canvases"; // 引入静态画布和交互画布组件
import { Renderer } from "../scene/Renderer"; // 引擎渲染器
import { ShapeCache } from "../scene/ShapeCache"; // 图形缓存
import { SVGLayer } from "./SVGLayer"; // SVG 图层组件
import { 
  setEraserCursor, 
  setCursor, 
  resetCursor, 
  setCursorForShape 
} from "../cursor"; // 操作光标样式的函数
import { Emitter } from "../emitter"; // 事件发射器
import { ElementCanvasButtons } from "../element/ElementCanvasButtons"; // 元素画布按钮
import { COLOR_PALETTE } from "../colors"; // 颜色调色板
import { ElementCanvasButton } from "./MagicButton"; // 魔法按钮组件
import { MagicIcon, copyIcon, fullscreenIcon } from "./icons"; // 导入不同图标的组件
import FollowMode from "./FollowMode/FollowMode"; // 跟随模式组件
import { Store, StoreAction } from "../store"; // 应用状态管理，和状态变更相关的类型
import { AnimationFrameHandler } from "../animation-frame-handler"; // 动画帧处理器
import { AnimatedTrail } from "../animated-trail"; // 动画轨迹
import { LaserTrails } from "../laser-trails"; // 激光轨迹
import { withBatchedUpdates, withBatchedUpdatesThrottled } from "../reactUtils"; // 用于批量更新的 React 工具函数
import { getRenderOpacity } from "../renderer/renderElement"; // 获取渲染元素的透明度
import { 
  hitElementBoundText, 
  hitElementBoundingBoxOnly, 
  hitElementItself 
} from "../element/collision"; // 判断元素是否被点击的函数
import { textWysiwyg } from "../element/textWysiwyg"; // 所见即所得文本处理
import { isOverScrollBars } from "../scene/scrollbars"; // 判断是否点击了滚动条
import { syncInvalidIndices, syncMovedIndices } from "../fractionalIndex"; // 同步索引的相关函数
import { 
  isPointHittingLink, 
  isPointHittingLinkIcon 
} from "./hyperlink/helpers"; // 判断点击是否命中链接相关的辅助函数
import { getShortcutFromShortcutName } from "../actions/shortcuts"; // 获取快捷键的动作
import { actionTextAutoResize } from "../actions/actionTextAutoResize"; // 文本自动调整大小的动作
import { getVisibleSceneBounds } from "../element/bounds"; // 获取可见场景边界
import { isMaybeMermaidDefinition } from "../mermaid"; // 判断是否为 Mermaid 定义
import NewElementCanvas from "./canvases/NewElementCanvas"; // 新元素画布
import { mutateElbowArrow, updateElbowArrow } from "../element/routing"; // 变更或更新弯头箭头的相关操作
import { 
  FlowChartCreator, 
  FlowChartNavigator, 
  getLinkDirectionFromKey 
} from "../element/flowchart"; // 流程图创建器和导航器
import { searchItemInFocusAtom } from "./SearchMenu"; // 搜索菜单中聚焦的项目的原子状态

// 数学相关的类型和工具函数
import type { LocalPoint, Radians } from "../../math"; // 本地坐标点和角度的类型
import { 
  clamp, 
  pointFrom, 
  pointDistance, 
  vector, 
  pointRotateRads, 
  vectorScale, 
  vectorFromPoint, 
  vectorSubtract, 
  vectorDot, 
  vectorNormalize 
} from "../../math"; // 数学运算相关的工具函数

import { cropElement } from "../element/cropElement"; // 剪裁元素的操作
import { wrapText } from "../element/textWrapping"; // 包装文本的操作

// 创建上下文对象：应用的状态和属性等
const AppContext = React.createContext<AppClassProperties>(null!); // 应用上下文
const AppPropsContext = React.createContext<AppProps>(null!); // 应用属性上下文

// 设备上下文的初始值：用于描述设备的特性
const deviceContextInitialValue = {
  viewport: {
    isMobile: false, // 是否是移动端
    isLandscape: false, // 是否是横屏
  },
  editor: {
    isMobile: false, // 编辑器是否是移动端
    canFitSidebar: false, // 编辑器是否能够适配侧边栏
  },
  isTouchScreen: false, // 是否为触摸屏
};

// 创建设备上下文
const DeviceContext = React.createContext<Device>(deviceContextInitialValue);
DeviceContext.displayName = "DeviceContext"; // 设置上下文的显示名称

// Excalidraw容器上下文，用于传递 Excalidraw 容器的 DOM 元素和其 ID
export const ExcalidrawContainerContext = React.createContext<{
  container: HTMLDivElement | null; // 该上下文保存一个 DOM 元素，表示 Excalidraw 容器
  id: string | null; // 该上下文保存容器的 ID
}>({ container: null, id: null });
ExcalidrawContainerContext.displayName = "ExcalidrawContainerContext"; // 设置上下文的显示名称，用于调试

// Excalidraw元素上下文，保存了所有未删除的 Excalidraw 元素（只读数组）
const ExcalidrawElementsContext = React.createContext<
  readonly NonDeletedExcalidrawElement[] // 该上下文保存一个数组，包含所有非删除的 Excalidraw 元素
>([]);
ExcalidrawElementsContext.displayName = "ExcalidrawElementsContext"; // 设置上下文的显示名称

// Excalidraw 应用状态上下文，用于存储应用状态，包括宽度、高度、位置等
const ExcalidrawAppStateContext = React.createContext<AppState>({
  ...getDefaultAppState(), // 获取默认的应用状态
  width: 0, // 宽度
  height: 0, // 高度
  offsetLeft: 0, // 水平偏移量
  offsetTop: 0, // 垂直偏移量
});
ExcalidrawAppStateContext.displayName = "ExcalidrawAppStateContext"; // 设置上下文的显示名称

// 用于更新 Excalidraw 应用状态的上下文，保存 setState 方法
const ExcalidrawSetAppStateContext = React.createContext<
  React.Component<any, AppState>["setState"] // 保存更新应用状态的 setState 方法
>(() => {
  console.warn("Uninitialized ExcalidrawSetAppStateContext context!"); // 如果上下文未初始化，发出警告
});
ExcalidrawSetAppStateContext.displayName = "ExcalidrawSetAppStateContext"; // 设置上下文的显示名称

// Excalidraw 动作管理器上下文，保存动作管理器实例
const ExcalidrawActionManagerContext = React.createContext<ActionManager>(
  null!, // 初始值为空，但必须保证它是 ActionManager 类型
);
ExcalidrawActionManagerContext.displayName = "ExcalidrawActionManagerContext"; // 设置上下文的显示名称

// 定义一系列 React Hooks，用于从上下文中获取状态和功能
export const useApp = () => useContext(AppContext); // 获取应用的上下文
export const useAppProps = () => useContext(AppPropsContext); // 获取应用属性的上下文
export const useDevice = () => useContext<Device>(DeviceContext); // 获取设备相关的上下文
export const useExcalidrawContainer = () =>
  useContext(ExcalidrawContainerContext); // 获取 Excalidraw 容器的上下文
export const useExcalidrawElements = () =>
  useContext(ExcalidrawElementsContext); // 获取 Excalidraw 元素的上下文
export const useExcalidrawAppState = () =>
  useContext(ExcalidrawAppStateContext); // 获取 Excalidraw 应用状态的上下文
export const useExcalidrawSetAppState = () =>
  useContext(ExcalidrawSetAppStateContext); // 获取更新 Excalidraw 应用状态的方法
export const useExcalidrawActionManager = () =>
  useContext(ExcalidrawActionManagerContext); // 获取 Excalidraw 动作管理器的上下文

// 以下是一些全局变量，用于跟踪当前的状态和行为

let didTapTwice: boolean = false; // 跟踪是否双击过
let tappedTwiceTimer = 0; // 双击计时器
let isHoldingSpace: boolean = false; // 是否按住空格键
let isPanning: boolean = false; // 是否正在平移
let isDraggingScrollBar: boolean = false; // 是否正在拖动滚动条
let currentScrollBars: ScrollBars = { horizontal: null, vertical: null }; // 当前滚动条状态，横向和纵向
let touchTimeout = 0; // 触摸超时计时器
let invalidateContextMenu = false; // 是否无效化右键菜单

/**
 * 用于映射 YouTube 嵌入视频的状态
 * 键是 Excalidraw 元素的 ID，值是视频的状态（从 YOUTUBE_STATES 中提取）
 */
const YOUTUBE_VIDEO_STATES = new Map<
  ExcalidrawElement["id"], // Excalidraw 元素 ID
  ValueOf<typeof YOUTUBE_STATES> // 对应的 YouTube 状态值
>();

let IS_PLAIN_PASTE = false; // 标记是否是纯文本粘贴
let IS_PLAIN_PASTE_TIMER = 0; // 纯文本粘贴计时器
let PLAIN_PASTE_TOAST_SHOWN = false; // 是否已经展示过纯文本粘贴提示

// 记录最后一次 pointerUp 事件的回调函数
let lastPointerUp: (() => void) | null = null;

// 定义手势对象，用于处理触摸手势的相关信息
const gesture: Gesture = {
  pointers: new Map(), // 存储指针信息（可能多个触摸点）
  lastCenter: null, // 最后触摸的中心点
  initialDistance: null, // 初始触摸距离
  initialScale: null, // 初始缩放比例
};

class App extends React.Component<AppProps, AppState> {
  canvas: AppClassProperties["canvas"];
  interactiveCanvas: AppClassProperties["interactiveCanvas"] = null;
  rc: RoughCanvas;
  unmounted: boolean = false;
  actionManager: ActionManager;
  device: Device = deviceContextInitialValue;

  private excalidrawContainerRef = React.createRef<HTMLDivElement>();

  public scene: Scene;
  public fonts: Fonts;
  public renderer: Renderer;
  public visibleElements: readonly NonDeletedExcalidrawElement[];
  private resizeObserver: ResizeObserver | undefined;
  private nearestScrollableContainer: HTMLElement | Document | undefined;
  public library: AppClassProperties["library"];
  public libraryItemsFromStorage: LibraryItems | undefined;
  public id: string;
  private store: Store;
  private history: History;
  public excalidrawContainerValue: {
    container: HTMLDivElement | null;
    id: string;
  };

  public files: BinaryFiles = {};
  public imageCache: AppClassProperties["imageCache"] = new Map();
  private iFrameRefs = new Map<ExcalidrawElement["id"], HTMLIFrameElement>();
  /**
   * Indicates whether the embeddable's url has been validated for rendering.
   * If value not set, indicates that the validation is pending.
   * Initially or on url change the flag is not reset so that we can guarantee
   * the validation came from a trusted source (the editor).
   **/
  private embedsValidationStatus: EmbedsValidationStatus = new Map();
  /** embeds that have been inserted to DOM (as a perf optim, we don't want to
   * insert to DOM before user initially scrolls to them) */
  private initializedEmbeds = new Set<ExcalidrawIframeLikeElement["id"]>();

  private elementsPendingErasure: ElementsPendingErasure = new Set();

  public flowChartCreator: FlowChartCreator = new FlowChartCreator();
  private flowChartNavigator: FlowChartNavigator = new FlowChartNavigator();

  hitLinkElement?: NonDeletedExcalidrawElement;
  lastPointerDownEvent: React.PointerEvent<HTMLElement> | null = null;
  lastPointerUpEvent: React.PointerEvent<HTMLElement> | PointerEvent | null =
    null;
  lastPointerMoveEvent: PointerEvent | null = null;
  lastPointerMoveCoords: { x: number; y: number } | null = null;
  lastViewportPosition = { x: 0, y: 0 };

  animationFrameHandler = new AnimationFrameHandler();

  laserTrails = new LaserTrails(this.animationFrameHandler, this);
  eraserTrail = new AnimatedTrail(this.animationFrameHandler, this, {
    streamline: 0.2,
    size: 5,
    keepHead: true,
    sizeMapping: (c) => {
      const DECAY_TIME = 200;
      const DECAY_LENGTH = 10;
      const t = Math.max(0, 1 - (performance.now() - c.pressure) / DECAY_TIME);
      const l =
        (DECAY_LENGTH -
          Math.min(DECAY_LENGTH, c.totalLength - c.currentIndex)) /
        DECAY_LENGTH;

      return Math.min(easeOut(l), easeOut(t));
    },
    fill: () =>
      this.state.theme === THEME.LIGHT
        ? "rgba(0, 0, 0, 0.2)"
        : "rgba(255, 255, 255, 0.2)",
  });

  onChangeEmitter = new Emitter<
    [
      elements: readonly ExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
    ]
  >();

  onPointerDownEmitter = new Emitter<
    [
      activeTool: AppState["activeTool"],
      pointerDownState: PointerDownState,
      event: React.PointerEvent<HTMLElement>,
    ]
  >();

  onPointerUpEmitter = new Emitter<
    [
      activeTool: AppState["activeTool"],
      pointerDownState: PointerDownState,
      event: PointerEvent,
    ]
  >();
  onUserFollowEmitter = new Emitter<[payload: OnUserFollowedPayload]>();
  onScrollChangeEmitter = new Emitter<
    [scrollX: number, scrollY: number, zoom: AppState["zoom"]]
  >();

  missingPointerEventCleanupEmitter = new Emitter<
    [event: PointerEvent | null]
  >();
  onRemoveEventListenersEmitter = new Emitter<[]>();

  constructor(props: AppProps) {
    super(props);
    const defaultAppState = getDefaultAppState();
    const {
      excalidrawAPI,
      viewModeEnabled = false,
      zenModeEnabled = false,
      gridModeEnabled = false,
      objectsSnapModeEnabled = false,
      theme = defaultAppState.theme,
      name = `${t("labels.untitled")}-${getDateTime()}`,
    } = props;
    this.state = {
      ...defaultAppState,
      theme,
      isLoading: true,
      ...this.getCanvasOffsets(),
      viewModeEnabled,
      zenModeEnabled,
      objectsSnapModeEnabled,
      gridModeEnabled: gridModeEnabled ?? defaultAppState.gridModeEnabled,
      name,
      width: window.innerWidth,
      height: window.innerHeight,
    };

    this.id = nanoid();
    this.library = new Library(this);
    this.actionManager = new ActionManager(
      this.syncActionResult,
      () => this.state,
      () => this.scene.getElementsIncludingDeleted(),
      this,
    );
    this.scene = new Scene();

    this.canvas = document.createElement("canvas");
    this.rc = rough.canvas(this.canvas);
    this.renderer = new Renderer(this.scene);
    this.visibleElements = [];

    this.store = new Store();
    this.history = new History();

    if (excalidrawAPI) {
      const api: ExcalidrawImperativeAPI = {
        updateScene: this.updateScene,
        updateLibrary: this.library.updateLibrary,
        addFiles: this.addFiles,
        resetScene: this.resetScene,
        getSceneElementsIncludingDeleted: this.getSceneElementsIncludingDeleted,
        history: {
          clear: this.resetHistory,
        },
        scrollToContent: this.scrollToContent,
        getSceneElements: this.getSceneElements,
        getAppState: () => this.state,
        getFiles: () => this.files,
        getName: this.getName,
        registerAction: (action: Action) => {
          this.actionManager.registerAction(action);
        },
        refresh: this.refresh,
        setToast: this.setToast,
        id: this.id,
        setActiveTool: this.setActiveTool,
        setCursor: this.setCursor,
        resetCursor: this.resetCursor,
        updateFrameRendering: this.updateFrameRendering,
        toggleSidebar: this.toggleSidebar,
        onChange: (cb) => this.onChangeEmitter.on(cb),
        onPointerDown: (cb) => this.onPointerDownEmitter.on(cb),
        onPointerUp: (cb) => this.onPointerUpEmitter.on(cb),
        onScrollChange: (cb) => this.onScrollChangeEmitter.on(cb),
        onUserFollow: (cb) => this.onUserFollowEmitter.on(cb),
      } as const;
      if (typeof excalidrawAPI === "function") {
        excalidrawAPI(api);
      } else {
        console.error("excalidrawAPI should be a function!");
      }
    }

    this.excalidrawContainerValue = {
      container: this.excalidrawContainerRef.current,
      id: this.id,
    };

    this.fonts = new Fonts(this.scene);
    this.history = new History();

    this.actionManager.registerAll(actions);
    this.actionManager.registerAction(
      createUndoAction(this.history, this.store),
    );
    this.actionManager.registerAction(
      createRedoAction(this.history, this.store),
    );
  }

  private onWindowMessage(event: MessageEvent) {
    if (
      event.origin !== "https://player.vimeo.com" &&
      event.origin !== "https://www.youtube.com"
    ) {
      return;
    }

    let data = null;
    try {
      data = JSON.parse(event.data);
    } catch (e) {}
    if (!data) {
      return;
    }

    switch (event.origin) {
      case "https://player.vimeo.com":
        //Allowing for multiple instances of Excalidraw running in the window
        if (data.method === "paused") {
          let source: Window | null = null;
          const iframes = document.body.querySelectorAll(
            "iframe.excalidraw__embeddable",
          );
          if (!iframes) {
            break;
          }
          for (const iframe of iframes as NodeListOf<HTMLIFrameElement>) {
            if (iframe.contentWindow === event.source) {
              source = iframe.contentWindow;
            }
          }
          source?.postMessage(
            JSON.stringify({
              method: data.value ? "play" : "pause",
              value: true,
            }),
            "*",
          );
        }
        break;
      case "https://www.youtube.com":
        if (
          data.event === "infoDelivery" &&
          data.info &&
          data.id &&
          typeof data.info.playerState === "number"
        ) {
          const id = data.id;
          const playerState = data.info.playerState as number;
          if (
            (Object.values(YOUTUBE_STATES) as number[]).includes(playerState)
          ) {
            YOUTUBE_VIDEO_STATES.set(
              id,
              playerState as ValueOf<typeof YOUTUBE_STATES>,
            );
          }
        }
        break;
    }
  }

  private cacheEmbeddableRef(
    element: ExcalidrawIframeLikeElement,
    ref: HTMLIFrameElement | null,
  ) {
    if (ref) {
      this.iFrameRefs.set(element.id, ref);
    }
  }

  /**
   * Returns gridSize taking into account `gridModeEnabled`.
   * If disabled, returns null.
   */
  public getEffectiveGridSize = () => {
    return (
      isGridModeEnabled(this) ? this.state.gridSize : null
    ) as NullableGridSize;
  };

  private getHTMLIFrameElement(
    element: ExcalidrawIframeLikeElement,
  ): HTMLIFrameElement | undefined {
    return this.iFrameRefs.get(element.id);
  }

  private handleEmbeddableCenterClick(element: ExcalidrawIframeLikeElement) {
    if (
      this.state.activeEmbeddable?.element === element &&
      this.state.activeEmbeddable?.state === "active"
    ) {
      return;
    }

    // The delay serves two purposes
    // 1. To prevent first click propagating to iframe on mobile,
    //    else the click will immediately start and stop the video
    // 2. If the user double clicks the frame center to activate it
    //    without the delay youtube will immediately open the video
    //    in fullscreen mode
    setTimeout(() => {
      this.setState({
        activeEmbeddable: { element, state: "active" },
        selectedElementIds: { [element.id]: true },
        newElement: null,
        selectionElement: null,
      });
    }, 100);

    if (isIframeElement(element)) {
      return;
    }

    const iframe = this.getHTMLIFrameElement(element);

    if (!iframe?.contentWindow) {
      return;
    }

    if (iframe.src.includes("youtube")) {
      const state = YOUTUBE_VIDEO_STATES.get(element.id);
      if (!state) {
        YOUTUBE_VIDEO_STATES.set(element.id, YOUTUBE_STATES.UNSTARTED);
        iframe.contentWindow.postMessage(
          JSON.stringify({
            event: "listening",
            id: element.id,
          }),
          "*",
        );
      }
      switch (state) {
        case YOUTUBE_STATES.PLAYING:
        case YOUTUBE_STATES.BUFFERING:
          iframe.contentWindow?.postMessage(
            JSON.stringify({
              event: "command",
              func: "pauseVideo",
              args: "",
            }),
            "*",
          );
          break;
        default:
          iframe.contentWindow?.postMessage(
            JSON.stringify({
              event: "command",
              func: "playVideo",
              args: "",
            }),
            "*",
          );
      }
    }

    if (iframe.src.includes("player.vimeo.com")) {
      iframe.contentWindow.postMessage(
        JSON.stringify({
          method: "paused", //video play/pause in onWindowMessage handler
        }),
        "*",
      );
    }
  }

  private isIframeLikeElementCenter(
    el: ExcalidrawIframeLikeElement | null,
    event: React.PointerEvent<HTMLElement> | PointerEvent,
    sceneX: number,
    sceneY: number,
  ) {
    return (
      el &&
      !event.altKey &&
      !event.shiftKey &&
      !event.metaKey &&
      !event.ctrlKey &&
      (this.state.activeEmbeddable?.element !== el ||
        this.state.activeEmbeddable?.state === "hover" ||
        !this.state.activeEmbeddable) &&
      sceneX >= el.x + el.width / 3 &&
      sceneX <= el.x + (2 * el.width) / 3 &&
      sceneY >= el.y + el.height / 3 &&
      sceneY <= el.y + (2 * el.height) / 3
    );
  }

  private updateEmbedValidationStatus = (
    element: ExcalidrawEmbeddableElement,
    status: boolean,
  ) => {
    this.embedsValidationStatus.set(element.id, status);
    ShapeCache.delete(element);
  };

  private updateEmbeddables = () => {
    const iframeLikes = new Set<ExcalidrawIframeLikeElement["id"]>();

    let updated = false;
    this.scene.getNonDeletedElements().filter((element) => {
      if (isEmbeddableElement(element)) {
        iframeLikes.add(element.id);
        if (!this.embedsValidationStatus.has(element.id)) {
          updated = true;

          const validated = embeddableURLValidator(
            element.link,
            this.props.validateEmbeddable,
          );

          this.updateEmbedValidationStatus(element, validated);
        }
      } else if (isIframeElement(element)) {
        iframeLikes.add(element.id);
      }
      return false;
    });

    if (updated) {
      this.scene.triggerUpdate();
    }

    // GC
    this.iFrameRefs.forEach((ref, id) => {
      if (!iframeLikes.has(id)) {
        this.iFrameRefs.delete(id);
      }
    });
  };

  private renderEmbeddables() {
    const scale = this.state.zoom.value;
    const normalizedWidth = this.state.width;
    const normalizedHeight = this.state.height;

    const embeddableElements = this.scene
      .getNonDeletedElements()
      .filter(
        (el): el is Ordered<NonDeleted<ExcalidrawIframeLikeElement>> =>
          (isEmbeddableElement(el) &&
            this.embedsValidationStatus.get(el.id) === true) ||
          isIframeElement(el),
      );

    return (
      <>
        {embeddableElements.map((el) => {
          const { x, y } = sceneCoordsToViewportCoords(
            { sceneX: el.x, sceneY: el.y },
            this.state,
          );

          const isVisible = isElementInViewport(
            el,
            normalizedWidth,
            normalizedHeight,
            this.state,
            this.scene.getNonDeletedElementsMap(),
          );
          const hasBeenInitialized = this.initializedEmbeds.has(el.id);

          if (isVisible && !hasBeenInitialized) {
            this.initializedEmbeds.add(el.id);
          }
          const shouldRender = isVisible || hasBeenInitialized;

          if (!shouldRender) {
            return null;
          }

          let src: IframeData | null;

          if (isIframeElement(el)) {
            src = null;

            const data: MagicGenerationData = (el.customData?.generationData ??
              this.magicGenerations.get(el.id)) || {
              status: "error",
              message: "No generation data",
              code: "ERR_NO_GENERATION_DATA",
            };

            if (data.status === "done") {
              const html = data.html;
              src = {
                intrinsicSize: { w: el.width, h: el.height },
                type: "document",
                srcdoc: () => {
                  return html;
                },
              } as const;
            } else if (data.status === "pending") {
              src = {
                intrinsicSize: { w: el.width, h: el.height },
                type: "document",
                srcdoc: () => {
                  return createSrcDoc(`
                    <style>
                      html, body {
                        width: 100%;
                        height: 100%;
                        color: ${
                          this.state.theme === THEME.DARK ? "white" : "black"
                        };
                      }
                      body {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-direction: column;
                        gap: 1rem;
                      }

                      .Spinner {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin-left: auto;
                        margin-right: auto;
                      }

                      .Spinner svg {
                        animation: rotate 1.6s linear infinite;
                        transform-origin: center center;
                        width: 40px;
                        height: 40px;
                      }

                      .Spinner circle {
                        stroke: currentColor;
                        animation: dash 1.6s linear 0s infinite;
                        stroke-linecap: round;
                      }

                      @keyframes rotate {
                        100% {
                          transform: rotate(360deg);
                        }
                      }

                      @keyframes dash {
                        0% {
                          stroke-dasharray: 1, 300;
                          stroke-dashoffset: 0;
                        }
                        50% {
                          stroke-dasharray: 150, 300;
                          stroke-dashoffset: -200;
                        }
                        100% {
                          stroke-dasharray: 1, 300;
                          stroke-dashoffset: -280;
                        }
                      }
                    </style>
                    <div class="Spinner">
                      <svg
                        viewBox="0 0 100 100"
                      >
                        <circle
                          cx="50"
                          cy="50"
                          r="46"
                          stroke-width="8"
                          fill="none"
                          stroke-miter-limit="10"
                        />
                      </svg>
                    </div>
                    <div>Generating...</div>
                  `);
                },
              } as const;
            } else {
              let message: string;
              if (data.code === "ERR_GENERATION_INTERRUPTED") {
                message = "Generation was interrupted...";
              } else {
                message = data.message || "Generation failed";
              }
              src = {
                intrinsicSize: { w: el.width, h: el.height },
                type: "document",
                srcdoc: () => {
                  return createSrcDoc(`
                    <style>
                    html, body {
                      height: 100%;
                    }
                      body {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        color: ${COLOR_PALETTE.red[3]};
                      }
                      h1, h3 {
                        margin-top: 0;
                        margin-bottom: 0.5rem;
                      }
                    </style>
                    <h1>Error!</h1>
                    <h3>${message}</h3>
                  `);
                },
              } as const;
            }
          } else {
            src = getEmbedLink(toValidURL(el.link || ""));
          }

          const isActive =
            this.state.activeEmbeddable?.element === el &&
            this.state.activeEmbeddable?.state === "active";
          const isHovered =
            this.state.activeEmbeddable?.element === el &&
            this.state.activeEmbeddable?.state === "hover";

          return (
            <div
              key={el.id}
              className={clsx("excalidraw__embeddable-container", {
                "is-hovered": isHovered,
              })}
              style={{
                transform: isVisible
                  ? `translate(${x - this.state.offsetLeft}px, ${
                      y - this.state.offsetTop
                    }px) scale(${scale})`
                  : "none",
                display: isVisible ? "block" : "none",
                opacity: getRenderOpacity(
                  el,
                  getContainingFrame(el, this.scene.getNonDeletedElementsMap()),
                  this.elementsPendingErasure,
                  null,
                ),
                ["--embeddable-radius" as string]: `${getCornerRadius(
                  Math.min(el.width, el.height),
                  el,
                )}px`,
              }}
            >
              <div
                //this is a hack that addresses isse with embedded excalidraw.com embeddable
                //https://github.com/excalidraw/excalidraw/pull/6691#issuecomment-1607383938
                /*ref={(ref) => {
                  if (!this.excalidrawContainerRef.current) {
                    return;
                  }
                  const container = this.excalidrawContainerRef.current;
                  const sh = container.scrollHeight;
                  const ch = container.clientHeight;
                  if (sh !== ch) {
                    container.style.height = `${sh}px`;
                    setTimeout(() => {
                      container.style.height = `100%`;
                    });
                  }
                }}*/
                className="excalidraw__embeddable-container__inner"
                style={{
                  width: isVisible ? `${el.width}px` : 0,
                  height: isVisible ? `${el.height}px` : 0,
                  transform: isVisible ? `rotate(${el.angle}rad)` : "none",
                  pointerEvents: isActive
                    ? POINTER_EVENTS.enabled
                    : POINTER_EVENTS.disabled,
                }}
              >
                {isHovered && (
                  <div className="excalidraw__embeddable-hint">
                    {t("buttons.embeddableInteractionButton")}
                  </div>
                )}
                <div
                  className="excalidraw__embeddable__outer"
                  style={{
                    padding: `${el.strokeWidth}px`,
                  }}
                >
                  {(isEmbeddableElement(el)
                    ? this.props.renderEmbeddable?.(el, this.state)
                    : null) ?? (
                    <iframe
                      ref={(ref) => this.cacheEmbeddableRef(el, ref)}
                      className="excalidraw__embeddable"
                      srcDoc={
                        src?.type === "document"
                          ? src.srcdoc(this.state.theme)
                          : undefined
                      }
                      src={
                        src?.type !== "document" ? src?.link ?? "" : undefined
                      }
                      // https://stackoverflow.com/q/18470015
                      scrolling="no"
                      referrerPolicy="no-referrer-when-downgrade"
                      title="Excalidraw Embedded Content"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen={true}
                      sandbox={`${
                        src?.sandbox?.allowSameOrigin ? "allow-same-origin" : ""
                      } allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-downloads`}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </>
    );
  }

  private getFrameNameDOMId = (frameElement: ExcalidrawElement) => {
    return `${this.id}-frame-name-${frameElement.id}`;
  };

  frameNameBoundsCache: FrameNameBoundsCache = {
    get: (frameElement) => {
      let bounds = this.frameNameBoundsCache._cache.get(frameElement.id);
      if (
        !bounds ||
        bounds.zoom !== this.state.zoom.value ||
        bounds.versionNonce !== frameElement.versionNonce
      ) {
        const frameNameDiv = document.getElementById(
          this.getFrameNameDOMId(frameElement),
        );

        if (frameNameDiv) {
          const box = frameNameDiv.getBoundingClientRect();
          const boxSceneTopLeft = viewportCoordsToSceneCoords(
            { clientX: box.x, clientY: box.y },
            this.state,
          );
          const boxSceneBottomRight = viewportCoordsToSceneCoords(
            { clientX: box.right, clientY: box.bottom },
            this.state,
          );

          bounds = {
            x: boxSceneTopLeft.x,
            y: boxSceneTopLeft.y,
            width: boxSceneBottomRight.x - boxSceneTopLeft.x,
            height: boxSceneBottomRight.y - boxSceneTopLeft.y,
            angle: 0,
            zoom: this.state.zoom.value,
            versionNonce: frameElement.versionNonce,
          };

          this.frameNameBoundsCache._cache.set(frameElement.id, bounds);

          return bounds;
        }
        return null;
      }

      return bounds;
    },
    /**
     * @private
     */
    _cache: new Map(),
  };

  private renderFrameNames = () => {
    if (!this.state.frameRendering.enabled || !this.state.frameRendering.name) {
      return null;
    }

    const isDarkTheme = this.state.theme === THEME.DARK;

    return this.scene.getNonDeletedFramesLikes().map((f) => {
      if (
        !isElementInViewport(
          f,
          this.canvas.width / window.devicePixelRatio,
          this.canvas.height / window.devicePixelRatio,
          {
            offsetLeft: this.state.offsetLeft,
            offsetTop: this.state.offsetTop,
            scrollX: this.state.scrollX,
            scrollY: this.state.scrollY,
            zoom: this.state.zoom,
          },
          this.scene.getNonDeletedElementsMap(),
        )
      ) {
        // if frame not visible, don't render its name
        return null;
      }

      const { x: x1, y: y1 } = sceneCoordsToViewportCoords(
        { sceneX: f.x, sceneY: f.y },
        this.state,
      );

      const FRAME_NAME_EDIT_PADDING = 6;

      const reset = () => {
        mutateElement(f, { name: f.name?.trim() || null });
        this.setState({ editingFrame: null });
      };

      let frameNameJSX;

      const frameName = getFrameLikeTitle(f);

      if (f.id === this.state.editingFrame) {
        const frameNameInEdit = frameName;

        frameNameJSX = (
          <input
            autoFocus
            value={frameNameInEdit}
            onChange={(e) => {
              mutateElement(f, {
                name: e.target.value,
              });
            }}
            onFocus={(e) => e.target.select()}
            onBlur={() => reset()}
            onKeyDown={(event) => {
              // for some inexplicable reason, `onBlur` triggered on ESC
              // does not reset `state.editingFrame` despite being called,
              // and we need to reset it here as well
              if (event.key === KEYS.ESCAPE || event.key === KEYS.ENTER) {
                reset();
              }
            }}
            style={{
              background: this.state.viewBackgroundColor,
              filter: isDarkTheme ? THEME_FILTER : "none",
              zIndex: 2,
              border: "none",
              display: "block",
              padding: `${FRAME_NAME_EDIT_PADDING}px`,
              borderRadius: 4,
              boxShadow: "inset 0 0 0 1px var(--color-primary)",
              fontFamily: "Assistant",
              fontSize: "14px",
              transform: `translate(-${FRAME_NAME_EDIT_PADDING}px, ${FRAME_NAME_EDIT_PADDING}px)`,
              color: "var(--color-gray-80)",
              overflow: "hidden",
              maxWidth: `${
                document.body.clientWidth - x1 - FRAME_NAME_EDIT_PADDING
              }px`,
            }}
            size={frameNameInEdit.length + 1 || 1}
            dir="auto"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
          />
        );
      } else {
        frameNameJSX = frameName;
      }

      return (
        <div
          id={this.getFrameNameDOMId(f)}
          key={f.id}
          style={{
            position: "absolute",
            // Positioning from bottom so that we don't to either
            // calculate text height or adjust using transform (which)
            // messes up input position when editing the frame name.
            // This makes the positioning deterministic and we can calculate
            // the same position when rendering to canvas / svg.
            bottom: `${
              this.state.height +
              FRAME_STYLE.nameOffsetY -
              y1 +
              this.state.offsetTop
            }px`,
            left: `${x1 - this.state.offsetLeft}px`,
            zIndex: 2,
            fontSize: FRAME_STYLE.nameFontSize,
            color: isDarkTheme
              ? FRAME_STYLE.nameColorDarkTheme
              : FRAME_STYLE.nameColorLightTheme,
            lineHeight: FRAME_STYLE.nameLineHeight,
            width: "max-content",
            maxWidth: `${f.width}px`,
            overflow: f.id === this.state.editingFrame ? "visible" : "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            cursor: CURSOR_TYPE.MOVE,
            pointerEvents: this.state.viewModeEnabled
              ? POINTER_EVENTS.disabled
              : POINTER_EVENTS.enabled,
          }}
          onPointerDown={(event) => this.handleCanvasPointerDown(event)}
          onWheel={(event) => this.handleWheel(event)}
          onContextMenu={this.handleCanvasContextMenu}
          onDoubleClick={() => {
            this.setState({
              editingFrame: f.id,
            });
          }}
        >
          {frameNameJSX}
        </div>
      );
    });
  };

  private toggleOverscrollBehavior(event: React.PointerEvent) {
    // when pointer inside editor, disable overscroll behavior to prevent
    // panning to trigger history back/forward on MacOS Chrome
    document.documentElement.style.overscrollBehaviorX =
      event.type === "pointerenter" ? "none" : "auto";
  }

  public render() {
    const selectedElements = this.scene.getSelectedElements(this.state);
    const { renderTopRightUI, renderCustomStats } = this.props;

    const sceneNonce = this.scene.getSceneNonce();
    const { elementsMap, visibleElements } =
      this.renderer.getRenderableElements({
        sceneNonce,
        zoom: this.state.zoom,
        offsetLeft: this.state.offsetLeft,
        offsetTop: this.state.offsetTop,
        scrollX: this.state.scrollX,
        scrollY: this.state.scrollY,
        height: this.state.height,
        width: this.state.width,
        editingTextElement: this.state.editingTextElement,
        newElementId: this.state.newElement?.id,
        pendingImageElementId: this.state.pendingImageElementId,
      });
    this.visibleElements = visibleElements;

    const allElementsMap = this.scene.getNonDeletedElementsMap();

    const shouldBlockPointerEvents =
      this.state.selectionElement ||
      this.state.newElement ||
      this.state.selectedElementsAreBeingDragged ||
      this.state.resizingElement ||
      (this.state.activeTool.type === "laser" &&
        // technically we can just test on this once we make it more safe
        this.state.cursorButton === "down");

    const firstSelectedElement = selectedElements[0];

    return (
      <div
        className={clsx("excalidraw excalidraw-container", {
          "excalidraw--view-mode": this.state.viewModeEnabled,
          "excalidraw--mobile": this.device.editor.isMobile,
        })}
        style={{
          ["--ui-pointerEvents" as any]: shouldBlockPointerEvents
            ? POINTER_EVENTS.disabled
            : POINTER_EVENTS.enabled,
        }}
        ref={this.excalidrawContainerRef}
        onDrop={this.handleAppOnDrop}
        tabIndex={0}
        onKeyDown={
          this.props.handleKeyboardGlobally ? undefined : this.onKeyDown
        }
        onPointerEnter={this.toggleOverscrollBehavior}
        onPointerLeave={this.toggleOverscrollBehavior}
      >
        <AppContext.Provider value={this}>
          <AppPropsContext.Provider value={this.props}>
            <ExcalidrawContainerContext.Provider
              value={this.excalidrawContainerValue}
            >
              <DeviceContext.Provider value={this.device}>
                <ExcalidrawSetAppStateContext.Provider value={this.setAppState}>
                  <ExcalidrawAppStateContext.Provider value={this.state}>
                    <ExcalidrawElementsContext.Provider
                      value={this.scene.getNonDeletedElements()}
                    >
                      <ExcalidrawActionManagerContext.Provider
                        value={this.actionManager}
                      >
                        <LayerUI
                          canvas={this.canvas}
                          appState={this.state}
                          files={this.files}
                          setAppState={this.setAppState}
                          actionManager={this.actionManager}
                          elements={this.scene.getNonDeletedElements()}
                          onLockToggle={this.toggleLock}
                          onPenModeToggle={this.togglePenMode}
                          onHandToolToggle={this.onHandToolToggle}
                          langCode={getLanguage().code}
                          renderTopRightUI={renderTopRightUI}
                          renderCustomStats={renderCustomStats}
                          showExitZenModeBtn={
                            typeof this.props?.zenModeEnabled === "undefined" &&
                            this.state.zenModeEnabled
                          }
                          UIOptions={this.props.UIOptions}
                          onExportImage={this.onExportImage}
                          renderWelcomeScreen={
                            !this.state.isLoading &&
                            this.state.showWelcomeScreen &&
                            this.state.activeTool.type === "selection" &&
                            !this.state.zenModeEnabled &&
                            !this.scene.getElementsIncludingDeleted().length
                          }
                          app={this}
                          isCollaborating={this.props.isCollaborating}
                        >
                          {this.props.children}
                        </LayerUI>

                        <div className="excalidraw-textEditorContainer" />
                        <div className="excalidraw-contextMenuContainer" />
                        <div className="excalidraw-eye-dropper-container" />
                        <SVGLayer
                          trails={[this.laserTrails, this.eraserTrail]}
                        />
                        {selectedElements.length === 1 &&
                          this.state.showHyperlinkPopup && (
                            <Hyperlink
                              key={firstSelectedElement.id}
                              element={firstSelectedElement}
                              elementsMap={allElementsMap}
                              setAppState={this.setAppState}
                              onLinkOpen={this.props.onLinkOpen}
                              setToast={this.setToast}
                              updateEmbedValidationStatus={
                                this.updateEmbedValidationStatus
                              }
                            />
                          )}
                        {this.props.aiEnabled !== false &&
                          selectedElements.length === 1 &&
                          isMagicFrameElement(firstSelectedElement) && (
                            <ElementCanvasButtons
                              element={firstSelectedElement}
                              elementsMap={elementsMap}
                            >
                              <ElementCanvasButton
                                title={t("labels.convertToCode")}
                                icon={MagicIcon}
                                checked={false}
                                onChange={() =>
                                  this.onMagicFrameGenerate(
                                    firstSelectedElement,
                                    "button",
                                  )
                                }
                              />
                            </ElementCanvasButtons>
                          )}
                        {selectedElements.length === 1 &&
                          isIframeElement(firstSelectedElement) &&
                          firstSelectedElement.customData?.generationData
                            ?.status === "done" && (
                            <ElementCanvasButtons
                              element={firstSelectedElement}
                              elementsMap={elementsMap}
                            >
                              <ElementCanvasButton
                                title={t("labels.copySource")}
                                icon={copyIcon}
                                checked={false}
                                onChange={() =>
                                  this.onIframeSrcCopy(firstSelectedElement)
                                }
                              />
                              <ElementCanvasButton
                                title="Enter fullscreen"
                                icon={fullscreenIcon}
                                checked={false}
                                onChange={() => {
                                  const iframe =
                                    this.getHTMLIFrameElement(
                                      firstSelectedElement,
                                    );
                                  if (iframe) {
                                    try {
                                      iframe.requestFullscreen();
                                      this.setState({
                                        activeEmbeddable: {
                                          element: firstSelectedElement,
                                          state: "active",
                                        },
                                        selectedElementIds: {
                                          [firstSelectedElement.id]: true,
                                        },
                                        newElement: null,
                                        selectionElement: null,
                                      });
                                    } catch (err: any) {
                                      console.warn(err);
                                      this.setState({
                                        errorMessage:
                                          "Couldn't enter fullscreen",
                                      });
                                    }
                                  }
                                }}
                              />
                            </ElementCanvasButtons>
                          )}
                        {this.state.toast !== null && (
                          <Toast
                            message={this.state.toast.message}
                            onClose={() => this.setToast(null)}
                            duration={this.state.toast.duration}
                            closable={this.state.toast.closable}
                          />
                        )}
                        {this.state.contextMenu && (
                          <ContextMenu
                            items={this.state.contextMenu.items}
                            top={this.state.contextMenu.top}
                            left={this.state.contextMenu.left}
                            actionManager={this.actionManager}
                            onClose={(callback) => {
                              this.setState({ contextMenu: null }, () => {
                                this.focusContainer();
                                callback?.();
                              });
                            }}
                          />
                        )}
                        <StaticCanvas
                          canvas={this.canvas}
                          rc={this.rc}
                          elementsMap={elementsMap}
                          allElementsMap={allElementsMap}
                          visibleElements={visibleElements}
                          sceneNonce={sceneNonce}
                          selectionNonce={
                            this.state.selectionElement?.versionNonce
                          }
                          scale={window.devicePixelRatio}
                          appState={this.state}
                          renderConfig={{
                            imageCache: this.imageCache,
                            isExporting: false,
                            renderGrid: isGridModeEnabled(this),
                            canvasBackgroundColor:
                              this.state.viewBackgroundColor,
                            embedsValidationStatus: this.embedsValidationStatus,
                            elementsPendingErasure: this.elementsPendingErasure,
                            pendingFlowchartNodes:
                              this.flowChartCreator.pendingNodes,
                          }}
                        />
                        {this.state.newElement && (
                          <NewElementCanvas
                            appState={this.state}
                            scale={window.devicePixelRatio}
                            rc={this.rc}
                            elementsMap={elementsMap}
                            allElementsMap={allElementsMap}
                            renderConfig={{
                              imageCache: this.imageCache,
                              isExporting: false,
                              renderGrid: false,
                              canvasBackgroundColor:
                                this.state.viewBackgroundColor,
                              embedsValidationStatus:
                                this.embedsValidationStatus,
                              elementsPendingErasure:
                                this.elementsPendingErasure,
                              pendingFlowchartNodes: null,
                            }}
                          />
                        )}
                        <InteractiveCanvas
                          containerRef={this.excalidrawContainerRef}
                          canvas={this.interactiveCanvas}
                          elementsMap={elementsMap}
                          visibleElements={visibleElements}
                          allElementsMap={allElementsMap}
                          selectedElements={selectedElements}
                          sceneNonce={sceneNonce}
                          selectionNonce={
                            this.state.selectionElement?.versionNonce
                          }
                          scale={window.devicePixelRatio}
                          appState={this.state}
                          device={this.device}
                          renderInteractiveSceneCallback={
                            this.renderInteractiveSceneCallback
                          }
                          handleCanvasRef={this.handleInteractiveCanvasRef}
                          onContextMenu={this.handleCanvasContextMenu}
                          onPointerMove={this.handleCanvasPointerMove}
                          onPointerUp={this.handleCanvasPointerUp}
                          onPointerCancel={this.removePointer}
                          onTouchMove={this.handleTouchMove}
                          onPointerDown={this.handleCanvasPointerDown}
                          onDoubleClick={this.handleCanvasDoubleClick}
                        />
                        {this.state.userToFollow && (
                          <FollowMode
                            width={this.state.width}
                            height={this.state.height}
                            userToFollow={this.state.userToFollow}
                            onDisconnect={this.maybeUnfollowRemoteUser}
                          />
                        )}
                        {this.renderFrameNames()}
                      </ExcalidrawActionManagerContext.Provider>
                      {this.renderEmbeddables()}
                    </ExcalidrawElementsContext.Provider>
                  </ExcalidrawAppStateContext.Provider>
                </ExcalidrawSetAppStateContext.Provider>
              </DeviceContext.Provider>
            </ExcalidrawContainerContext.Provider>
          </AppPropsContext.Provider>
        </AppContext.Provider>
      </div>
    );
  }

  public focusContainer: AppClassProperties["focusContainer"] = () => {
    this.excalidrawContainerRef.current?.focus();
  };

  public getSceneElementsIncludingDeleted = () => {
    return this.scene.getElementsIncludingDeleted();
  };

  public getSceneElements = () => {
    return this.scene.getNonDeletedElements();
  };

  public onInsertElements = (elements: readonly ExcalidrawElement[]) => {
    this.addElementsFromPasteOrLibrary({
      elements,
      position: "center",
      files: null,
    });
  };

  public onExportImage = async (
    type: keyof typeof EXPORT_IMAGE_TYPES,
    elements: ExportedElements,
    opts: { exportingFrame: ExcalidrawFrameLikeElement | null },
  ) => {
    trackEvent("export", type, "ui");
    const fileHandle = await exportCanvas(
      type,
      elements,
      this.state,
      this.files,
      {
        exportBackground: this.state.exportBackground,
        name: this.getName(),
        viewBackgroundColor: this.state.viewBackgroundColor,
        exportingFrame: opts.exportingFrame,
      },
    )
      .catch(muteFSAbortError)
      .catch((error) => {
        console.error(error);
        this.setState({ errorMessage: error.message });
      });

    if (
      this.state.exportEmbedScene &&
      fileHandle &&
      isImageFileHandle(fileHandle)
    ) {
      this.setState({ fileHandle });
    }
  };

  private magicGenerations = new Map<
    ExcalidrawIframeElement["id"],
    MagicGenerationData
  >();

  private updateMagicGeneration = ({
    frameElement,
    data,
  }: {
    frameElement: ExcalidrawIframeElement;
    data: MagicGenerationData;
  }) => {
    if (data.status === "pending") {
      // We don't wanna persist pending state to storage. It should be in-app
      // state only.
      // Thus reset so that we prefer local cache (if there was some
      // generationData set previously)
      mutateElement(
        frameElement,
        { customData: { generationData: undefined } },
        false,
      );
    } else {
      mutateElement(
        frameElement,
        { customData: { generationData: data } },
        false,
      );
    }
    this.magicGenerations.set(frameElement.id, data);
    this.triggerRender();
  };

  public plugins: {
    diagramToCode?: {
      generate: GenerateDiagramToCode;
    };
  } = {};

  public setPlugins(plugins: Partial<App["plugins"]>) {
    Object.assign(this.plugins, plugins);
  }

  private async onMagicFrameGenerate(
    magicFrame: ExcalidrawMagicFrameElement,
    source: "button" | "upstream",
  ) {
    const generateDiagramToCode = this.plugins.diagramToCode?.generate;

    if (!generateDiagramToCode) {
      this.setState({
        errorMessage: "No diagram to code plugin found",
      });
      return;
    }

    const magicFrameChildren = getElementsOverlappingFrame(
      this.scene.getNonDeletedElements(),
      magicFrame,
    ).filter((el) => !isMagicFrameElement(el));

    if (!magicFrameChildren.length) {
      if (source === "button") {
        this.setState({ errorMessage: "Cannot generate from an empty frame" });
        trackEvent("ai", "generate (no-children)", "d2c");
      } else {
        this.setActiveTool({ type: "magicframe" });
      }
      return;
    }

    const frameElement = this.insertIframeElement({
      sceneX: magicFrame.x + magicFrame.width + 30,
      sceneY: magicFrame.y,
      width: magicFrame.width,
      height: magicFrame.height,
    });

    if (!frameElement) {
      return;
    }

    this.updateMagicGeneration({
      frameElement,
      data: { status: "pending" },
    });

    this.setState({
      selectedElementIds: { [frameElement.id]: true },
    });

    trackEvent("ai", "generate (start)", "d2c");
    try {
      const { html } = await generateDiagramToCode({
        frame: magicFrame,
        children: magicFrameChildren,
      });

      trackEvent("ai", "generate (success)", "d2c");

      if (!html.trim()) {
        this.updateMagicGeneration({
          frameElement,
          data: {
            status: "error",
            code: "ERR_OAI",
            message: "Nothing genereated :(",
          },
        });
        return;
      }

      const parsedHtml =
        html.includes("<!DOCTYPE html>") && html.includes("</html>")
          ? html.slice(
              html.indexOf("<!DOCTYPE html>"),
              html.indexOf("</html>") + "</html>".length,
            )
          : html;

      this.updateMagicGeneration({
        frameElement,
        data: { status: "done", html: parsedHtml },
      });
    } catch (error: any) {
      trackEvent("ai", "generate (failed)", "d2c");
      this.updateMagicGeneration({
        frameElement,
        data: {
          status: "error",
          code: "ERR_OAI",
          message: error.message || "Unknown error during generation",
        },
      });
    }
  }

  private onIframeSrcCopy(element: ExcalidrawIframeElement) {
    if (element.customData?.generationData?.status === "done") {
      copyTextToSystemClipboard(element.customData.generationData.html);
      this.setToast({
        message: "copied to clipboard",
        closable: false,
        duration: 1500,
      });
    }
  }

  public onMagicframeToolSelect = () => {
    const selectedElements = this.scene.getSelectedElements({
      selectedElementIds: this.state.selectedElementIds,
    });

    if (selectedElements.length === 0) {
      this.setActiveTool({ type: TOOL_TYPE.magicframe });
      trackEvent("ai", "tool-select (empty-selection)", "d2c");
    } else {
      const selectedMagicFrame: ExcalidrawMagicFrameElement | false =
        selectedElements.length === 1 &&
        isMagicFrameElement(selectedElements[0]) &&
        selectedElements[0];

      // case: user selected elements containing frame-like(s) or are frame
      // members, we don't want to wrap into another magicframe
      // (unless the only selected element is a magic frame which we reuse)
      if (
        !selectedMagicFrame &&
        selectedElements.some((el) => isFrameLikeElement(el) || el.frameId)
      ) {
        this.setActiveTool({ type: TOOL_TYPE.magicframe });
        return;
      }

      trackEvent("ai", "tool-select (existing selection)", "d2c");

      let frame: ExcalidrawMagicFrameElement;
      if (selectedMagicFrame) {
        // a single magicframe already selected -> use it
        frame = selectedMagicFrame;
      } else {
        // selected elements aren't wrapped in magic frame yet -> wrap now

        const [minX, minY, maxX, maxY] = getCommonBounds(selectedElements);
        const padding = 50;

        frame = newMagicFrameElement({
          ...FRAME_STYLE,
          x: minX - padding,
          y: minY - padding,
          width: maxX - minX + padding * 2,
          height: maxY - minY + padding * 2,
          opacity: 100,
          locked: false,
        });

        this.scene.insertElement(frame);

        for (const child of selectedElements) {
          mutateElement(child, { frameId: frame.id });
        }

        this.setState({
          selectedElementIds: { [frame.id]: true },
        });
      }

      this.onMagicFrameGenerate(frame, "upstream");
    }
  };

  private openEyeDropper = ({ type }: { type: "stroke" | "background" }) => {
    jotaiStore.set(activeEyeDropperAtom, {
      swapPreviewOnAlt: true,
      colorPickerType:
        type === "stroke" ? "elementStroke" : "elementBackground",
      onSelect: (color, event) => {
        const shouldUpdateStrokeColor =
          (type === "background" && event.altKey) ||
          (type === "stroke" && !event.altKey);
        const selectedElements = this.scene.getSelectedElements(this.state);
        if (
          !selectedElements.length ||
          this.state.activeTool.type !== "selection"
        ) {
          if (shouldUpdateStrokeColor) {
            this.syncActionResult({
              appState: { ...this.state, currentItemStrokeColor: color },
              storeAction: StoreAction.CAPTURE,
            });
          } else {
            this.syncActionResult({
              appState: { ...this.state, currentItemBackgroundColor: color },
              storeAction: StoreAction.CAPTURE,
            });
          }
        } else {
          this.updateScene({
            elements: this.scene.getElementsIncludingDeleted().map((el) => {
              if (this.state.selectedElementIds[el.id]) {
                return newElementWith(el, {
                  [shouldUpdateStrokeColor ? "strokeColor" : "backgroundColor"]:
                    color,
                });
              }
              return el;
            }),
            storeAction: StoreAction.CAPTURE,
          });
        }
      },
      keepOpenOnAlt: false,
    });
  };

  public dismissLinearEditor = () => {
    setTimeout(() => {
      this.setState({
        editingLinearElement: null,
      });
    });
  };

  public syncActionResult = withBatchedUpdates((actionResult: ActionResult) => {
    if (this.unmounted || actionResult === false) {
      return;
    }

    if (actionResult.storeAction === StoreAction.UPDATE) {
      this.store.shouldUpdateSnapshot();
    } else if (actionResult.storeAction === StoreAction.CAPTURE) {
      this.store.shouldCaptureIncrement();
    }

    let didUpdate = false;

    let editingTextElement: AppState["editingTextElement"] | null = null;
    if (actionResult.elements) {
      this.scene.replaceAllElements(actionResult.elements);
      didUpdate = true;
    }

    if (actionResult.files) {
      this.addMissingFiles(actionResult.files, actionResult.replaceFiles);
      this.addNewImagesToImageCache();
    }

    if (actionResult.appState || editingTextElement || this.state.contextMenu) {
      let viewModeEnabled = actionResult?.appState?.viewModeEnabled || false;
      let zenModeEnabled = actionResult?.appState?.zenModeEnabled || false;
      const theme =
        actionResult?.appState?.theme || this.props.theme || THEME.LIGHT;
      const name = actionResult?.appState?.name ?? this.state.name;
      const errorMessage =
        actionResult?.appState?.errorMessage ?? this.state.errorMessage;
      if (typeof this.props.viewModeEnabled !== "undefined") {
        viewModeEnabled = this.props.viewModeEnabled;
      }

      if (typeof this.props.zenModeEnabled !== "undefined") {
        zenModeEnabled = this.props.zenModeEnabled;
      }

      editingTextElement = actionResult.appState?.editingTextElement || null;

      // make sure editingTextElement points to latest element reference
      if (actionResult.elements && editingTextElement) {
        actionResult.elements.forEach((element) => {
          if (
            editingTextElement?.id === element.id &&
            editingTextElement !== element &&
            isNonDeletedElement(element) &&
            isTextElement(element)
          ) {
            editingTextElement = element;
          }
        });
      }

      if (editingTextElement?.isDeleted) {
        editingTextElement = null;
      }

      this.setState((prevAppState) => {
        const actionAppState = actionResult.appState || {};

        return {
          ...prevAppState,
          ...actionAppState,
          // NOTE this will prevent opening context menu using an action
          // or programmatically from the host, so it will need to be
          // rewritten later
          contextMenu: null,
          editingTextElement,
          viewModeEnabled,
          zenModeEnabled,
          theme,
          name,
          errorMessage,
        };
      });

      didUpdate = true;
    }

    if (!didUpdate && actionResult.storeAction !== StoreAction.NONE) {
      this.scene.triggerUpdate();
    }
  });

  // Lifecycle

  private onBlur = withBatchedUpdates(() => {
    isHoldingSpace = false;
    this.setState({ isBindingEnabled: true });
  });

  private onUnload = () => {
    this.onBlur();
  };

  private disableEvent: EventListener = (event) => {
    event.preventDefault();
  };

  private resetHistory = () => {
    this.history.clear();
  };

  private resetStore = () => {
    this.store.clear();
  };

  /**
   * Resets scene & history.
   * ! Do not use to clear scene user action !
   */
  private resetScene = withBatchedUpdates(
    (opts?: { resetLoadingState: boolean }) => {
      this.scene.replaceAllElements([]);
      this.setState((state) => ({
        ...getDefaultAppState(),
        isLoading: opts?.resetLoadingState ? false : state.isLoading,
        theme: this.state.theme,
      }));
      this.resetStore();
      this.resetHistory();
    },
  );

  private initializeScene = async () => {
    if ("launchQueue" in window && "LaunchParams" in window) {
      (window as any).launchQueue.setConsumer(
        async (launchParams: { files: any[] }) => {
          if (!launchParams.files.length) {
            return;
          }
          const fileHandle = launchParams.files[0];
          const blob: Blob = await fileHandle.getFile();
          this.loadFileToCanvas(
            new File([blob], blob.name || "", { type: blob.type }),
            fileHandle,
          );
        },
      );
    }

    if (this.props.theme) {
      this.setState({ theme: this.props.theme });
    }
    if (!this.state.isLoading) {
      this.setState({ isLoading: true });
    }
    let initialData = null;
    try {
      if (typeof this.props.initialData === "function") {
        initialData = (await this.props.initialData()) || null;
      } else {
        initialData = (await this.props.initialData) || null;
      }
      if (initialData?.libraryItems) {
        this.library
          .updateLibrary({
            libraryItems: initialData.libraryItems,
            merge: true,
          })
          .catch((error) => {
            console.error(error);
          });
      }
    } catch (error: any) {
      console.error(error);
      initialData = {
        appState: {
          errorMessage:
            error.message ||
            "Encountered an error during importing or restoring scene data",
        },
      };
    }
    const scene = restore(initialData, null, null, { repairBindings: true });
    scene.appState = {
      ...scene.appState,
      theme: this.props.theme || scene.appState.theme,
      // we're falling back to current (pre-init) state when deciding
      // whether to open the library, to handle a case where we
      // update the state outside of initialData (e.g. when loading the app
      // with a library install link, which should auto-open the library)
      openSidebar: scene.appState?.openSidebar || this.state.openSidebar,
      activeTool:
        scene.appState.activeTool.type === "image"
          ? { ...scene.appState.activeTool, type: "selection" }
          : scene.appState.activeTool,
      isLoading: false,
      toast: this.state.toast,
    };
    if (initialData?.scrollToContent) {
      scene.appState = {
        ...scene.appState,
        ...calculateScrollCenter(scene.elements, {
          ...scene.appState,
          width: this.state.width,
          height: this.state.height,
          offsetTop: this.state.offsetTop,
          offsetLeft: this.state.offsetLeft,
        }),
      };
    }

    this.resetStore();
    this.resetHistory();
    this.syncActionResult({
      ...scene,
      storeAction: StoreAction.UPDATE,
    });

    // clear the shape and image cache so that any images in initialData
    // can be loaded fresh
    this.clearImageShapeCache();

    // manually loading the font faces seems faster even in browsers that do fire the loadingdone event
    this.fonts.loadSceneFonts().then((fontFaces) => {
      this.fonts.onLoaded(fontFaces);
    });
  };

  private isMobileBreakpoint = (width: number, height: number) => {
    return (
      width < MQ_MAX_WIDTH_PORTRAIT ||
      (height < MQ_MAX_HEIGHT_LANDSCAPE && width < MQ_MAX_WIDTH_LANDSCAPE)
    );
  };

  private refreshViewportBreakpoints = () => {
    const container = this.excalidrawContainerRef.current;
    if (!container) {
      return;
    }

    const { clientWidth: viewportWidth, clientHeight: viewportHeight } =
      document.body;

    const prevViewportState = this.device.viewport;

    const nextViewportState = updateObject(prevViewportState, {
      isLandscape: viewportWidth > viewportHeight,
      isMobile: this.isMobileBreakpoint(viewportWidth, viewportHeight),
    });

    if (prevViewportState !== nextViewportState) {
      this.device = { ...this.device, viewport: nextViewportState };
      return true;
    }
    return false;
  };

  private refreshEditorBreakpoints = () => {
    const container = this.excalidrawContainerRef.current;
    if (!container) {
      return;
    }

    const { width: editorWidth, height: editorHeight } =
      container.getBoundingClientRect();

    const sidebarBreakpoint =
      this.props.UIOptions.dockedSidebarBreakpoint != null
        ? this.props.UIOptions.dockedSidebarBreakpoint
        : MQ_RIGHT_SIDEBAR_MIN_WIDTH;

    const prevEditorState = this.device.editor;

    const nextEditorState = updateObject(prevEditorState, {
      isMobile: this.isMobileBreakpoint(editorWidth, editorHeight),
      canFitSidebar: editorWidth > sidebarBreakpoint,
    });

    if (prevEditorState !== nextEditorState) {
      this.device = { ...this.device, editor: nextEditorState };
      return true;
    }
    return false;
  };

  private clearImageShapeCache(filesMap?: BinaryFiles) {
    const files = filesMap ?? this.files;
    this.scene.getNonDeletedElements().forEach((element) => {
      if (isInitializedImageElement(element) && files[element.fileId]) {
        this.imageCache.delete(element.fileId);
        ShapeCache.delete(element);
      }
    });
  }

  public async componentDidMount() {
    this.unmounted = false;
    this.excalidrawContainerValue.container =
      this.excalidrawContainerRef.current;

    if (import.meta.env.MODE === ENV.TEST || import.meta.env.DEV) {
      const setState = this.setState.bind(this);
      Object.defineProperties(window.h, {
        state: {
          configurable: true,
          get: () => {
            return this.state;
          },
        },
        setState: {
          configurable: true,
          value: (...args: Parameters<typeof setState>) => {
            return this.setState(...args);
          },
        },
        app: {
          configurable: true,
          value: this,
        },
        history: {
          configurable: true,
          value: this.history,
        },
        store: {
          configurable: true,
          value: this.store,
        },
        fonts: {
          configurable: true,
          value: this.fonts,
        },
      });
    }

    this.store.onStoreIncrementEmitter.on((increment) => {
      this.history.record(increment.elementsChange, increment.appStateChange);
    });

    this.scene.onUpdate(this.triggerRender);
    this.addEventListeners();

    if (this.props.autoFocus && this.excalidrawContainerRef.current) {
      this.focusContainer();
    }

    if (
      // bounding rects don't work in tests so updating
      // the state on init would result in making the test enviro run
      // in mobile breakpoint (0 width/height), making everything fail
      !isTestEnv()
    ) {
      this.refreshViewportBreakpoints();
      this.refreshEditorBreakpoints();
    }

    if (supportsResizeObserver && this.excalidrawContainerRef.current) {
      this.resizeObserver = new ResizeObserver(() => {
        this.refreshEditorBreakpoints();
        this.updateDOMRect();
      });
      this.resizeObserver?.observe(this.excalidrawContainerRef.current);
    }

    const searchParams = new URLSearchParams(window.location.search.slice(1));

    if (searchParams.has("web-share-target")) {
      // Obtain a file that was shared via the Web Share Target API.
      this.restoreFileFromShare();
    } else {
      this.updateDOMRect(this.initializeScene);
    }

    // note that this check seems to always pass in localhost
    if (isBrave() && !isMeasureTextSupported()) {
      this.setState({
        errorMessage: <BraveMeasureTextError />,
      });
    }
  }

  public componentWillUnmount() {
    (window as any).launchQueue?.setConsumer(() => {});
    this.renderer.destroy();
    this.scene.destroy();
    this.scene = new Scene();
    this.fonts = new Fonts(this.scene);
    this.renderer = new Renderer(this.scene);
    this.files = {};
    this.imageCache.clear();
    this.resizeObserver?.disconnect();
    this.unmounted = true;
    this.removeEventListeners();
    this.library.destroy();
    this.laserTrails.stop();
    this.eraserTrail.stop();
    this.onChangeEmitter.clear();
    this.store.onStoreIncrementEmitter.clear();
    ShapeCache.destroy();
    SnapCache.destroy();
    clearTimeout(touchTimeout);
    isSomeElementSelected.clearCache();
    selectGroupsForSelectedElements.clearCache();
    touchTimeout = 0;
    document.documentElement.style.overscrollBehaviorX = "";
  }

  private onResize = withBatchedUpdates(() => {
    this.scene
      .getElementsIncludingDeleted()
      .forEach((element) => ShapeCache.delete(element));
    this.refreshViewportBreakpoints();
    this.updateDOMRect();
    if (!supportsResizeObserver) {
      this.refreshEditorBreakpoints();
    }
    this.setState({});
  });

  /** generally invoked only if fullscreen was invoked programmatically */
  private onFullscreenChange = () => {
    if (
      // points to the iframe element we fullscreened
      !document.fullscreenElement &&
      this.state.activeEmbeddable?.state === "active"
    ) {
      this.setState({
        activeEmbeddable: null,
      });
    }
  };

  private removeEventListeners() {
    this.onRemoveEventListenersEmitter.trigger();
  }

  private addEventListeners() {
    // remove first as we can add event listeners multiple times
    this.removeEventListeners();

    // -------------------------------------------------------------------------
    //                        view+edit mode listeners
    // -------------------------------------------------------------------------

    if (this.props.handleKeyboardGlobally) {
      this.onRemoveEventListenersEmitter.once(
        addEventListener(document, EVENT.KEYDOWN, this.onKeyDown, false),
      );
    }

    this.onRemoveEventListenersEmitter.once(
      addEventListener(
        this.excalidrawContainerRef.current,
        EVENT.WHEEL,
        this.handleWheel,
        { passive: false },
      ),
      addEventListener(window, EVENT.MESSAGE, this.onWindowMessage, false),
      addEventListener(document, EVENT.POINTER_UP, this.removePointer, {
        passive: false,
      }), // #3553
      addEventListener(document, EVENT.COPY, this.onCopy, { passive: false }),
      addEventListener(document, EVENT.KEYUP, this.onKeyUp, { passive: true }),
      addEventListener(
        document,
        EVENT.POINTER_MOVE,
        this.updateCurrentCursorPosition,
        { passive: false },
      ),
      // rerender text elements on font load to fix #637 && #1553
      addEventListener(
        document.fonts,
        "loadingdone",
        (event) => {
          const fontFaces = (event as FontFaceSetLoadEvent).fontfaces;
          this.fonts.onLoaded(fontFaces);
        },
        { passive: false },
      ),
      // Safari-only desktop pinch zoom
      addEventListener(
        document,
        EVENT.GESTURE_START,
        this.onGestureStart as any,
        false,
      ),
      addEventListener(
        document,
        EVENT.GESTURE_CHANGE,
        this.onGestureChange as any,
        false,
      ),
      addEventListener(
        document,
        EVENT.GESTURE_END,
        this.onGestureEnd as any,
        false,
      ),
      addEventListener(
        window,
        EVENT.FOCUS,
        () => {
          this.maybeCleanupAfterMissingPointerUp(null);
          // browsers (chrome?) tend to free up memory a lot, which results
          // in canvas context being cleared. Thus re-render on focus.
          this.triggerRender(true);
        },
        { passive: false },
      ),
    );

    if (this.state.viewModeEnabled) {
      return;
    }

    // -------------------------------------------------------------------------
    //                        edit-mode listeners only
    // -------------------------------------------------------------------------

    this.onRemoveEventListenersEmitter.once(
      addEventListener(
        document,
        EVENT.FULLSCREENCHANGE,
        this.onFullscreenChange,
        { passive: false },
      ),
      addEventListener(document, EVENT.PASTE, this.pasteFromClipboard, {
        passive: false,
      }),
      addEventListener(document, EVENT.CUT, this.onCut, { passive: false }),
      addEventListener(window, EVENT.RESIZE, this.onResize, false),
      addEventListener(window, EVENT.UNLOAD, this.onUnload, false),
      addEventListener(window, EVENT.BLUR, this.onBlur, false),
      addEventListener(
        this.excalidrawContainerRef.current,
        EVENT.WHEEL,
        this.handleWheel,
        { passive: false },
      ),
      addEventListener(
        this.excalidrawContainerRef.current,
        EVENT.DRAG_OVER,
        this.disableEvent,
        false,
      ),
      addEventListener(
        this.excalidrawContainerRef.current,
        EVENT.DROP,
        this.disableEvent,
        false,
      ),
    );

    if (this.props.detectScroll) {
      this.onRemoveEventListenersEmitter.once(
        addEventListener(
          getNearestScrollableContainer(this.excalidrawContainerRef.current!),
          EVENT.SCROLL,
          this.onScroll,
          { passive: false },
        ),
      );
    }
  }

  componentDidUpdate(prevProps: AppProps, prevState: AppState) {
    this.updateEmbeddables();
    const elements = this.scene.getElementsIncludingDeleted();
    const elementsMap = this.scene.getElementsMapIncludingDeleted();
    const nonDeletedElementsMap = this.scene.getNonDeletedElementsMap();

    if (!this.state.showWelcomeScreen && !elements.length) {
      this.setState({ showWelcomeScreen: true });
    }

    if (
      prevProps.UIOptions.dockedSidebarBreakpoint !==
      this.props.UIOptions.dockedSidebarBreakpoint
    ) {
      this.refreshEditorBreakpoints();
    }

    const hasFollowedPersonLeft =
      prevState.userToFollow &&
      !this.state.collaborators.has(prevState.userToFollow.socketId);

    if (hasFollowedPersonLeft) {
      this.maybeUnfollowRemoteUser();
    }

    if (
      prevState.zoom.value !== this.state.zoom.value ||
      prevState.scrollX !== this.state.scrollX ||
      prevState.scrollY !== this.state.scrollY
    ) {
      this.props?.onScrollChange?.(
        this.state.scrollX,
        this.state.scrollY,
        this.state.zoom,
      );
      this.onScrollChangeEmitter.trigger(
        this.state.scrollX,
        this.state.scrollY,
        this.state.zoom,
      );
    }

    if (prevState.userToFollow !== this.state.userToFollow) {
      if (prevState.userToFollow) {
        this.onUserFollowEmitter.trigger({
          userToFollow: prevState.userToFollow,
          action: "UNFOLLOW",
        });
      }

      if (this.state.userToFollow) {
        this.onUserFollowEmitter.trigger({
          userToFollow: this.state.userToFollow,
          action: "FOLLOW",
        });
      }
    }

    if (
      Object.keys(this.state.selectedElementIds).length &&
      isEraserActive(this.state)
    ) {
      this.setState({
        activeTool: updateActiveTool(this.state, { type: "selection" }),
      });
    }
    if (
      this.state.activeTool.type === "eraser" &&
      prevState.theme !== this.state.theme
    ) {
      setEraserCursor(this.interactiveCanvas, this.state.theme);
    }
    // Hide hyperlink popup if shown when element type is not selection
    if (
      prevState.activeTool.type === "selection" &&
      this.state.activeTool.type !== "selection" &&
      this.state.showHyperlinkPopup
    ) {
      this.setState({ showHyperlinkPopup: false });
    }
    if (prevProps.langCode !== this.props.langCode) {
      this.updateLanguage();
    }

    if (isEraserActive(prevState) && !isEraserActive(this.state)) {
      this.eraserTrail.endPath();
    }

    if (prevProps.viewModeEnabled !== this.props.viewModeEnabled) {
      this.setState({ viewModeEnabled: !!this.props.viewModeEnabled });
    }

    if (prevState.viewModeEnabled !== this.state.viewModeEnabled) {
      this.addEventListeners();
      this.deselectElements();
    }

    if (prevProps.zenModeEnabled !== this.props.zenModeEnabled) {
      this.setState({ zenModeEnabled: !!this.props.zenModeEnabled });
    }

    if (prevProps.theme !== this.props.theme && this.props.theme) {
      this.setState({ theme: this.props.theme });
    }

    this.excalidrawContainerRef.current?.classList.toggle(
      "theme--dark",
      this.state.theme === THEME.DARK,
    );

    if (
      this.state.editingLinearElement &&
      !this.state.selectedElementIds[this.state.editingLinearElement.elementId]
    ) {
      // defer so that the storeAction flag isn't reset via current update
      setTimeout(() => {
        // execute only if the condition still holds when the deferred callback
        // executes (it can be scheduled multiple times depending on how
        // many times the component renders)
        this.state.editingLinearElement &&
          this.actionManager.executeAction(actionFinalize);
      });
    }

    // failsafe in case the state is being updated in incorrect order resulting
    // in the editingTextElement being now a deleted element
    if (this.state.editingTextElement?.isDeleted) {
      this.setState({ editingTextElement: null });
    }

    if (
      this.state.selectedLinearElement &&
      !this.state.selectedElementIds[this.state.selectedLinearElement.elementId]
    ) {
      // To make sure `selectedLinearElement` is in sync with `selectedElementIds`, however this shouldn't be needed once
      // we have a single API to update `selectedElementIds`
      this.setState({ selectedLinearElement: null });
    }

    const { multiElement } = prevState;
    if (
      prevState.activeTool !== this.state.activeTool &&
      multiElement != null &&
      isBindingEnabled(this.state) &&
      isBindingElement(multiElement, false)
    ) {
      maybeBindLinearElement(
        multiElement,
        this.state,
        tupleToCoors(
          LinearElementEditor.getPointAtIndexGlobalCoordinates(
            multiElement,
            -1,
            nonDeletedElementsMap,
          ),
        ),
        this.scene.getNonDeletedElementsMap(),
        this.scene.getNonDeletedElements(),
      );
    }

    this.store.commit(elementsMap, this.state);

    // Do not notify consumers if we're still loading the scene. Among other
    // potential issues, this fixes a case where the tab isn't focused during
    // init, which would trigger onChange with empty elements, which would then
    // override whatever is in localStorage currently.
    if (!this.state.isLoading) {
      this.props.onChange?.(elements, this.state, this.files);
      this.onChangeEmitter.trigger(elements, this.state, this.files);
    }
  }

  private renderInteractiveSceneCallback = ({
    atLeastOneVisibleElement,
    scrollBars,
    elementsMap,
  }: RenderInteractiveSceneCallback) => {
    if (scrollBars) {
      currentScrollBars = scrollBars;
    }
    const scrolledOutside =
      // hide when editing text
      this.state.editingTextElement
        ? false
        : !atLeastOneVisibleElement && elementsMap.size > 0;
    if (this.state.scrolledOutside !== scrolledOutside) {
      this.setState({ scrolledOutside });
    }

    this.scheduleImageRefresh();
  };

  private onScroll = debounce(() => {
    const { offsetTop, offsetLeft } = this.getCanvasOffsets();
    this.setState((state) => {
      if (state.offsetLeft === offsetLeft && state.offsetTop === offsetTop) {
        return null;
      }
      return { offsetTop, offsetLeft };
    });
  }, SCROLL_TIMEOUT);

  // Copy/paste

  private onCut = withBatchedUpdates((event: ClipboardEvent) => {
    const isExcalidrawActive = this.excalidrawContainerRef.current?.contains(
      document.activeElement,
    );
    if (!isExcalidrawActive || isWritableElement(event.target)) {
      return;
    }
    this.actionManager.executeAction(actionCut, "keyboard", event);
    event.preventDefault();
    event.stopPropagation();
  });

  private onCopy = withBatchedUpdates((event: ClipboardEvent) => {
    const isExcalidrawActive = this.excalidrawContainerRef.current?.contains(
      document.activeElement,
    );
    if (!isExcalidrawActive || isWritableElement(event.target)) {
      return;
    }
    this.actionManager.executeAction(actionCopy, "keyboard", event);
    event.preventDefault();
    event.stopPropagation();
  });

  private static resetTapTwice() {
    didTapTwice = false;
  }

  private onTouchStart = (event: TouchEvent) => {
    // fix for Apple Pencil Scribble (do not prevent for other devices)
    if (isIOS) {
      event.preventDefault();
    }

    if (!didTapTwice) {
      didTapTwice = true;
      clearTimeout(tappedTwiceTimer);
      tappedTwiceTimer = window.setTimeout(
        App.resetTapTwice,
        TAP_TWICE_TIMEOUT,
      );
      return;
    }
    // insert text only if we tapped twice with a single finger
    // event.touches.length === 1 will also prevent inserting text when user's zooming
    if (didTapTwice && event.touches.length === 1) {
      const touch = event.touches[0];
      // @ts-ignore
      this.handleCanvasDoubleClick({
        clientX: touch.clientX,
        clientY: touch.clientY,
      });
      didTapTwice = false;
      clearTimeout(tappedTwiceTimer);
    }

    if (event.touches.length === 2) {
      this.setState({
        selectedElementIds: makeNextSelectedElementIds({}, this.state),
        activeEmbeddable: null,
      });
    }
  };

  private onTouchEnd = (event: TouchEvent) => {
    this.resetContextMenuTimer();
    if (event.touches.length > 0) {
      this.setState({
        previousSelectedElementIds: {},
        selectedElementIds: makeNextSelectedElementIds(
          this.state.previousSelectedElementIds,
          this.state,
        ),
      });
    } else {
      gesture.pointers.clear();
    }
  };

  public pasteFromClipboard = withBatchedUpdates(
    async (event: ClipboardEvent) => {
      const isPlainPaste = !!IS_PLAIN_PASTE;

      // #686
      const target = document.activeElement;
      const isExcalidrawActive =
        this.excalidrawContainerRef.current?.contains(target);
      if (event && !isExcalidrawActive) {
        return;
      }

      const elementUnderCursor = document.elementFromPoint(
        this.lastViewportPosition.x,
        this.lastViewportPosition.y,
      );
      if (
        event &&
        (!(elementUnderCursor instanceof HTMLCanvasElement) ||
          isWritableElement(target))
      ) {
        return;
      }

      const { x: sceneX, y: sceneY } = viewportCoordsToSceneCoords(
        {
          clientX: this.lastViewportPosition.x,
          clientY: this.lastViewportPosition.y,
        },
        this.state,
      );

      // must be called in the same frame (thus before any awaits) as the paste
      // event else some browsers (FF...) will clear the clipboardData
      // (something something security)
      let file = event?.clipboardData?.files[0];
      const data = await parseClipboard(event, isPlainPaste);
      if (!file && !isPlainPaste) {
        if (data.mixedContent) {
          return this.addElementsFromMixedContentPaste(data.mixedContent, {
            isPlainPaste,
            sceneX,
            sceneY,
          });
        } else if (data.text) {
          const string = data.text.trim();
          if (string.startsWith("<svg") && string.endsWith("</svg>")) {
            // ignore SVG validation/normalization which will be done during image
            // initialization
            file = SVGStringToFile(string);
          }
        }
      }

      // prefer spreadsheet data over image file (MS Office/Libre Office)
      if (isSupportedImageFile(file) && !data.spreadsheet) {
        if (!this.isToolSupported("image")) {
          this.setState({ errorMessage: t("errors.imageToolNotSupported") });
          return;
        }

        const imageElement = this.createImageElement({ sceneX, sceneY });
        this.insertImageElement(imageElement, file);
        this.initializeImageDimensions(imageElement);
        this.setState({
          selectedElementIds: makeNextSelectedElementIds(
            {
              [imageElement.id]: true,
            },
            this.state,
          ),
        });

        return;
      }

      if (this.props.onPaste) {
        try {
          if ((await this.props.onPaste(data, event)) === false) {
            return;
          }
        } catch (error: any) {
          console.error(error);
        }
      }

      if (data.errorMessage) {
        this.setState({ errorMessage: data.errorMessage });
      } else if (data.spreadsheet && !isPlainPaste) {
        this.setState({
          pasteDialog: {
            data: data.spreadsheet,
            shown: true,
          },
        });
      } else if (data.elements) {
        const elements = (
          data.programmaticAPI
            ? convertToExcalidrawElements(
                data.elements as ExcalidrawElementSkeleton[],
              )
            : data.elements
        ) as readonly ExcalidrawElement[];
        // TODO remove formatting from elements if isPlainPaste
        this.addElementsFromPasteOrLibrary({
          elements,
          files: data.files || null,
          position: "cursor",
          retainSeed: isPlainPaste,
        });
      } else if (data.text) {
        if (data.text && isMaybeMermaidDefinition(data.text)) {
          const api = await import("@excalidraw/mermaid-to-excalidraw");

          try {
            const { elements: skeletonElements, files } =
              await api.parseMermaidToExcalidraw(data.text);

            const elements = convertToExcalidrawElements(skeletonElements, {
              regenerateIds: true,
            });

            this.addElementsFromPasteOrLibrary({
              elements,
              files,
              position: "cursor",
            });

            return;
          } catch (err: any) {
            console.warn(
              `parsing pasted text as mermaid definition failed: ${err.message}`,
            );
          }
        }

        const nonEmptyLines = normalizeEOL(data.text)
          .split(/\n+/)
          .map((s) => s.trim())
          .filter(Boolean);

        const embbeddableUrls = nonEmptyLines
          .map((str) => maybeParseEmbedSrc(str))
          .filter((string) => {
            return (
              embeddableURLValidator(string, this.props.validateEmbeddable) &&
              (/^(http|https):\/\/[^\s/$.?#].[^\s]*$/.test(string) ||
                getEmbedLink(string)?.type === "video")
            );
          });

        if (
          !IS_PLAIN_PASTE &&
          embbeddableUrls.length > 0 &&
          // if there were non-embeddable text (lines) mixed in with embeddable
          // urls, ignore and paste as text
          embbeddableUrls.length === nonEmptyLines.length
        ) {
          const embeddables: NonDeleted<ExcalidrawEmbeddableElement>[] = [];
          for (const url of embbeddableUrls) {
            const prevEmbeddable: ExcalidrawEmbeddableElement | undefined =
              embeddables[embeddables.length - 1];
            const embeddable = this.insertEmbeddableElement({
              sceneX: prevEmbeddable
                ? prevEmbeddable.x + prevEmbeddable.width + 20
                : sceneX,
              sceneY,
              link: normalizeLink(url),
            });
            if (embeddable) {
              embeddables.push(embeddable);
            }
          }
          if (embeddables.length) {
            this.setState({
              selectedElementIds: Object.fromEntries(
                embeddables.map((embeddable) => [embeddable.id, true]),
              ),
            });
          }
          return;
        }
        this.addTextFromPaste(data.text, isPlainPaste);
      }
      this.setActiveTool({ type: "selection" });
      event?.preventDefault();
    },
  );

  addElementsFromPasteOrLibrary = (opts: {
    elements: readonly ExcalidrawElement[];
    files: BinaryFiles | null;
    position: { clientX: number; clientY: number } | "cursor" | "center";
    retainSeed?: boolean;
    fitToContent?: boolean;
  }) => {
    let elements = opts.elements.map((el, _, elements) => {
      if (isElbowArrow(el)) {
        const startEndElements = [
          el.startBinding &&
            elements.find((l) => l.id === el.startBinding?.elementId),
          el.endBinding &&
            elements.find((l) => l.id === el.endBinding?.elementId),
        ];
        const startBinding = startEndElements[0] ? el.startBinding : null;
        const endBinding = startEndElements[1] ? el.endBinding : null;
        return {
          ...el,
          ...updateElbowArrow(
            {
              ...el,
              startBinding,
              endBinding,
            },
            toBrandedType<NonDeletedSceneElementsMap>(
              new Map(
                startEndElements
                  .filter((x) => x != null)
                  .map(
                    (el) =>
                      [el!.id, el] as [
                        string,
                        Ordered<NonDeletedExcalidrawElement>,
                      ],
                  ),
              ),
            ),
            [el.points[0], el.points[el.points.length - 1]],
          ),
        };
      }

      return el;
    });
    elements = restoreElements(elements, null, undefined);
    const [minX, minY, maxX, maxY] = getCommonBounds(elements);

    const elementsCenterX = distance(minX, maxX) / 2;
    const elementsCenterY = distance(minY, maxY) / 2;

    const clientX =
      typeof opts.position === "object"
        ? opts.position.clientX
        : opts.position === "cursor"
        ? this.lastViewportPosition.x
        : this.state.width / 2 + this.state.offsetLeft;
    const clientY =
      typeof opts.position === "object"
        ? opts.position.clientY
        : opts.position === "cursor"
        ? this.lastViewportPosition.y
        : this.state.height / 2 + this.state.offsetTop;

    const { x, y } = viewportCoordsToSceneCoords(
      { clientX, clientY },
      this.state,
    );

    const dx = x - elementsCenterX;
    const dy = y - elementsCenterY;

    const [gridX, gridY] = getGridPoint(dx, dy, this.getEffectiveGridSize());

    const newElements = duplicateElements(
      elements.map((element) => {
        return newElementWith(element, {
          x: element.x + gridX - minX,
          y: element.y + gridY - minY,
        });
      }),
      {
        randomizeSeed: !opts.retainSeed,
      },
    );

    const prevElements = this.scene.getElementsIncludingDeleted();
    const nextElements = [...prevElements, ...newElements];

    syncMovedIndices(nextElements, arrayToMap(newElements));

    const topLayerFrame = this.getTopLayerFrameAtSceneCoords({ x, y });

    if (topLayerFrame) {
      const eligibleElements = filterElementsEligibleAsFrameChildren(
        newElements,
        topLayerFrame,
      );
      addElementsToFrame(nextElements, eligibleElements, topLayerFrame);
    }

    this.scene.replaceAllElements(nextElements);

    newElements.forEach((newElement) => {
      if (isTextElement(newElement) && isBoundToContainer(newElement)) {
        const container = getContainerElement(
          newElement,
          this.scene.getElementsMapIncludingDeleted(),
        );
        redrawTextBoundingBox(
          newElement,
          container,
          this.scene.getElementsMapIncludingDeleted(),
        );
      }
    });

    // paste event may not fire FontFace loadingdone event in Safari, hence loading font faces manually
    if (isSafari) {
      Fonts.loadElementsFonts(newElements).then((fontFaces) => {
        this.fonts.onLoaded(fontFaces);
      });
    }

    if (opts.files) {
      this.addMissingFiles(opts.files);
    }

    this.store.shouldCaptureIncrement();

    const nextElementsToSelect =
      excludeElementsInFramesFromSelection(newElements);

    this.setState(
      {
        ...this.state,
        // keep sidebar (presumably the library) open if it's docked and
        // can fit.
        //
        // Note, we should close the sidebar only if we're dropping items
        // from library, not when pasting from clipboard. Alas.
        openSidebar:
          this.state.openSidebar &&
          this.device.editor.canFitSidebar &&
          jotaiStore.get(isSidebarDockedAtom)
            ? this.state.openSidebar
            : null,
        ...selectGroupsForSelectedElements(
          {
            editingGroupId: null,
            selectedElementIds: nextElementsToSelect.reduce(
              (acc: Record<ExcalidrawElement["id"], true>, element) => {
                if (!isBoundToContainer(element)) {
                  acc[element.id] = true;
                }
                return acc;
              },
              {},
            ),
          },
          this.scene.getNonDeletedElements(),
          this.state,
          this,
        ),
      },
      () => {
        if (opts.files) {
          this.addNewImagesToImageCache();
        }
      },
    );
    this.setActiveTool({ type: "selection" });

    if (opts.fitToContent) {
      this.scrollToContent(newElements, {
        fitToContent: true,
        canvasOffsets: this.getEditorUIOffsets(),
      });
    }
  };

  // TODO rewrite this to paste both text & images at the same time if
  // pasted data contains both
  private async addElementsFromMixedContentPaste(
    mixedContent: PastedMixedContent,
    {
      isPlainPaste,
      sceneX,
      sceneY,
    }: { isPlainPaste: boolean; sceneX: number; sceneY: number },
  ) {
    if (
      !isPlainPaste &&
      mixedContent.some((node) => node.type === "imageUrl") &&
      this.isToolSupported("image")
    ) {
      const imageURLs = mixedContent
        .filter((node) => node.type === "imageUrl")
        .map((node) => node.value);
      const responses = await Promise.all(
        imageURLs.map(async (url) => {
          try {
            return { file: await ImageURLToFile(url) };
          } catch (error: any) {
            let errorMessage = error.message;
            if (error.cause === "FETCH_ERROR") {
              errorMessage = t("errors.failedToFetchImage");
            } else if (error.cause === "UNSUPPORTED") {
              errorMessage = t("errors.unsupportedFileType");
            }
            return { errorMessage };
          }
        }),
      );
      let y = sceneY;
      let firstImageYOffsetDone = false;
      const nextSelectedIds: Record<ExcalidrawElement["id"], true> = {};
      for (const response of responses) {
        if (response.file) {
          const imageElement = this.createImageElement({
            sceneX,
            sceneY: y,
          });

          const initializedImageElement = await this.insertImageElement(
            imageElement,
            response.file,
          );
          if (initializedImageElement) {
            // vertically center first image in the batch
            if (!firstImageYOffsetDone) {
              firstImageYOffsetDone = true;
              y -= initializedImageElement.height / 2;
            }
            // hack to reset the `y` coord because we vertically center during
            // insertImageElement
            mutateElement(initializedImageElement, { y }, false);

            y = imageElement.y + imageElement.height + 25;

            nextSelectedIds[imageElement.id] = true;
          }
        }
      }

      this.setState({
        selectedElementIds: makeNextSelectedElementIds(
          nextSelectedIds,
          this.state,
        ),
      });

      const error = responses.find((response) => !!response.errorMessage);
      if (error && error.errorMessage) {
        this.setState({ errorMessage: error.errorMessage });
      }
    } else {
      const textNodes = mixedContent.filter((node) => node.type === "text");
      if (textNodes.length) {
        this.addTextFromPaste(
          textNodes.map((node) => node.value).join("\n\n"),
          isPlainPaste,
        );
      }
    }
  }

  private addTextFromPaste(text: string, isPlainPaste = false) {
    const { x, y } = viewportCoordsToSceneCoords(
      {
        clientX: this.lastViewportPosition.x,
        clientY: this.lastViewportPosition.y,
      },
      this.state,
    );

    const textElementProps = {
      x,
      y,
      strokeColor: this.state.currentItemStrokeColor,
      backgroundColor: this.state.currentItemBackgroundColor,
      fillStyle: this.state.currentItemFillStyle,
      strokeWidth: this.state.currentItemStrokeWidth,
      strokeStyle: this.state.currentItemStrokeStyle,
      roundness: null,
      roughness: this.state.currentItemRoughness,
      opacity: this.state.currentItemOpacity,
      text,
      fontSize: this.state.currentItemFontSize,
      fontFamily: this.state.currentItemFontFamily,
      textAlign: DEFAULT_TEXT_ALIGN,
      verticalAlign: DEFAULT_VERTICAL_ALIGN,
      locked: false,
    };
    const fontString = getFontString({
      fontSize: textElementProps.fontSize,
      fontFamily: textElementProps.fontFamily,
    });
    const lineHeight = getLineHeight(textElementProps.fontFamily);
    const [x1, , x2] = getVisibleSceneBounds(this.state);
    // long texts should not go beyond 800 pixels in width nor should it go below 200 px
    const maxTextWidth = Math.max(Math.min((x2 - x1) * 0.5, 800), 200);
    const LINE_GAP = 10;
    let currentY = y;

    const lines = isPlainPaste ? [text] : text.split("\n");
    const textElements = lines.reduce(
      (acc: ExcalidrawTextElement[], line, idx) => {
        const originalText = normalizeText(line).trim();
        if (originalText.length) {
          const topLayerFrame = this.getTopLayerFrameAtSceneCoords({
            x,
            y: currentY,
          });

          let metrics = measureText(originalText, fontString, lineHeight);
          const isTextUnwrapped = metrics.width > maxTextWidth;

          const text = isTextUnwrapped
            ? wrapText(originalText, fontString, maxTextWidth)
            : originalText;

          metrics = isTextUnwrapped
            ? measureText(text, fontString, lineHeight)
            : metrics;

          const startX = x - metrics.width / 2;
          const startY = currentY - metrics.height / 2;

          const element = newTextElement({
            ...textElementProps,
            x: startX,
            y: startY,
            text,
            originalText,
            lineHeight,
            autoResize: !isTextUnwrapped,
            frameId: topLayerFrame ? topLayerFrame.id : null,
          });
          acc.push(element);
          currentY += element.height + LINE_GAP;
        } else {
          const prevLine = lines[idx - 1]?.trim();
          // add paragraph only if previous line was not empty, IOW don't add
          // more than one empty line
          if (prevLine) {
            currentY +=
              getLineHeightInPx(textElementProps.fontSize, lineHeight) +
              LINE_GAP;
          }
        }

        return acc;
      },
      [],
    );

    if (textElements.length === 0) {
      return;
    }

    this.scene.insertElements(textElements);

    this.setState({
      selectedElementIds: makeNextSelectedElementIds(
        Object.fromEntries(textElements.map((el) => [el.id, true])),
        this.state,
      ),
    });

    if (
      !isPlainPaste &&
      textElements.length > 1 &&
      PLAIN_PASTE_TOAST_SHOWN === false &&
      !this.device.editor.isMobile
    ) {
      this.setToast({
        message: t("toast.pasteAsSingleElement", {
          shortcut: getShortcutKey("CtrlOrCmd+Shift+V"),
        }),
        duration: 5000,
      });
      PLAIN_PASTE_TOAST_SHOWN = true;
    }

    this.store.shouldCaptureIncrement();
  }

  setAppState: React.Component<any, AppState>["setState"] = (
    state,
    callback,
  ) => {
    this.setState(state, callback);
  };

  removePointer = (event: React.PointerEvent<HTMLElement> | PointerEvent) => {
    if (touchTimeout) {
      this.resetContextMenuTimer();
    }

    gesture.pointers.delete(event.pointerId);
  };

  toggleLock = (source: "keyboard" | "ui" = "ui") => {
    if (!this.state.activeTool.locked) {
      trackEvent(
        "toolbar",
        "toggleLock",
        `${source} (${this.device.editor.isMobile ? "mobile" : "desktop"})`,
      );
    }
    this.setState((prevState) => {
      return {
        activeTool: {
          ...prevState.activeTool,
          ...updateActiveTool(
            this.state,
            prevState.activeTool.locked
              ? { type: "selection" }
              : prevState.activeTool,
          ),
          locked: !prevState.activeTool.locked,
        },
      };
    });
  };

  updateFrameRendering = (
    opts:
      | Partial<AppState["frameRendering"]>
      | ((
          prevState: AppState["frameRendering"],
        ) => Partial<AppState["frameRendering"]>),
  ) => {
    this.setState((prevState) => {
      const next =
        typeof opts === "function" ? opts(prevState.frameRendering) : opts;
      return {
        frameRendering: {
          enabled: next?.enabled ?? prevState.frameRendering.enabled,
          clip: next?.clip ?? prevState.frameRendering.clip,
          name: next?.name ?? prevState.frameRendering.name,
          outline: next?.outline ?? prevState.frameRendering.outline,
        },
      };
    });
  };

  togglePenMode = (force: boolean | null) => {
    this.setState((prevState) => {
      return {
        penMode: force ?? !prevState.penMode,
        penDetected: true,
      };
    });
  };

  onHandToolToggle = () => {
    this.actionManager.executeAction(actionToggleHandTool);
  };

  /**
   * Zooms on canvas viewport center
   */
  zoomCanvas = (
    /**
     * Decimal fraction, auto-clamped between MIN_ZOOM and MAX_ZOOM.
     * 1 = 100% zoom, 2 = 200% zoom, 0.5 = 50% zoom
     */
    value: number,
  ) => {
    this.setState({
      ...getStateForZoom(
        {
          viewportX: this.state.width / 2 + this.state.offsetLeft,
          viewportY: this.state.height / 2 + this.state.offsetTop,
          nextZoom: getNormalizedZoom(value),
        },
        this.state,
      ),
    });
  };

  private cancelInProgressAnimation: (() => void) | null = null;

  scrollToContent = (
    target:
      | ExcalidrawElement
      | readonly ExcalidrawElement[] = this.scene.getNonDeletedElements(),
    opts?: (
      | {
          fitToContent?: boolean;
          fitToViewport?: never;
          viewportZoomFactor?: number;
          animate?: boolean;
          duration?: number;
        }
      | {
          fitToContent?: never;
          fitToViewport?: boolean;
          /** when fitToViewport=true, how much screen should the content cover,
           * between 0.1 (10%) and 1 (100%)
           */
          viewportZoomFactor?: number;
          animate?: boolean;
          duration?: number;
        }
    ) & {
      minZoom?: number;
      maxZoom?: number;
      canvasOffsets?: Offsets;
    },
  ) => {
    this.cancelInProgressAnimation?.();

    // convert provided target into ExcalidrawElement[] if necessary
    const targetElements = Array.isArray(target) ? target : [target];

    let zoom = this.state.zoom;
    let scrollX = this.state.scrollX;
    let scrollY = this.state.scrollY;

    if (opts?.fitToContent || opts?.fitToViewport) {
      const { appState } = zoomToFit({
        canvasOffsets: opts.canvasOffsets,
        targetElements,
        appState: this.state,
        fitToViewport: !!opts?.fitToViewport,
        viewportZoomFactor: opts?.viewportZoomFactor,
        minZoom: opts?.minZoom,
        maxZoom: opts?.maxZoom,
      });
      zoom = appState.zoom;
      scrollX = appState.scrollX;
      scrollY = appState.scrollY;
    } else {
      // compute only the viewport location, without any zoom adjustment
      const scroll = calculateScrollCenter(targetElements, this.state);
      scrollX = scroll.scrollX;
      scrollY = scroll.scrollY;
    }

    // when animating, we use RequestAnimationFrame to prevent the animation
    // from slowing down other processes
    if (opts?.animate) {
      const origScrollX = this.state.scrollX;
      const origScrollY = this.state.scrollY;
      const origZoom = this.state.zoom.value;

      const cancel = easeToValuesRAF({
        fromValues: {
          scrollX: origScrollX,
          scrollY: origScrollY,
          zoom: origZoom,
        },
        toValues: { scrollX, scrollY, zoom: zoom.value },
        interpolateValue: (from, to, progress, key) => {
          // for zoom, use different easing
          if (key === "zoom") {
            return from * Math.pow(to / from, easeOut(progress));
          }
          // handle using default
          return undefined;
        },
        onStep: ({ scrollX, scrollY, zoom }) => {
          this.setState({
            scrollX,
            scrollY,
            zoom: { value: zoom },
          });
        },
        onStart: () => {
          this.setState({ shouldCacheIgnoreZoom: true });
        },
        onEnd: () => {
          this.setState({ shouldCacheIgnoreZoom: false });
        },
        onCancel: () => {
          this.setState({ shouldCacheIgnoreZoom: false });
        },
        duration: opts?.duration ?? 500,
      });

      this.cancelInProgressAnimation = () => {
        cancel();
        this.cancelInProgressAnimation = null;
      };
    } else {
      this.setState({ scrollX, scrollY, zoom });
    }
  };

  private maybeUnfollowRemoteUser = () => {
    if (this.state.userToFollow) {
      this.setState({ userToFollow: null });
    }
  };

  /** use when changing scrollX/scrollY/zoom based on user interaction */
  private translateCanvas: React.Component<any, AppState>["setState"] = (
    state,
  ) => {
    this.cancelInProgressAnimation?.();
    this.maybeUnfollowRemoteUser();
    this.setState(state);
  };

  setToast = (
    toast: {
      message: string;
      closable?: boolean;
      duration?: number;
    } | null,
  ) => {
    this.setState({ toast });
  };

  restoreFileFromShare = async () => {
    try {
      const webShareTargetCache = await caches.open("web-share-target");

      const response = await webShareTargetCache.match("shared-file");
      if (response) {
        const blob = await response.blob();
        const file = new File([blob], blob.name || "", { type: blob.type });
        this.loadFileToCanvas(file, null);
        await webShareTargetCache.delete("shared-file");
        window.history.replaceState(null, APP_NAME, window.location.pathname);
      }
    } catch (error: any) {
      this.setState({ errorMessage: error.message });
    }
  };

  /**
   * adds supplied files to existing files in the appState.
   * NOTE if file already exists in editor state, the file data is not updated
   * */
  public addFiles: ExcalidrawImperativeAPI["addFiles"] = withBatchedUpdates(
    (files) => {
      const { addedFiles } = this.addMissingFiles(files);

      this.clearImageShapeCache(addedFiles);
      this.scene.triggerUpdate();

      this.addNewImagesToImageCache();
    },
  );

  private addMissingFiles = (
    files: BinaryFiles | BinaryFileData[],
    replace = false,
  ) => {
    const nextFiles = replace ? {} : { ...this.files };
    const addedFiles: BinaryFiles = {};

    const _files = Array.isArray(files) ? files : Object.values(files);

    for (const fileData of _files) {
      if (nextFiles[fileData.id]) {
        continue;
      }

      addedFiles[fileData.id] = fileData;
      nextFiles[fileData.id] = fileData;

      if (fileData.mimeType === MIME_TYPES.svg) {
        const restoredDataURL = getDataURL_sync(
          normalizeSVG(dataURLToString(fileData.dataURL)),
          MIME_TYPES.svg,
        );
        if (fileData.dataURL !== restoredDataURL) {
          // bump version so persistence layer can update the store
          fileData.version = (fileData.version ?? 1) + 1;
          fileData.dataURL = restoredDataURL;
        }
      }
    }

    this.files = nextFiles;

    return { addedFiles };
  };

  public updateScene = withBatchedUpdates(
    <K extends keyof AppState>(sceneData: {
      elements?: SceneData["elements"];
      appState?: Pick<AppState, K> | null;
      collaborators?: SceneData["collaborators"];
      /** @default StoreAction.NONE */
      storeAction?: SceneData["storeAction"];
    }) => {
      const nextElements = syncInvalidIndices(sceneData.elements ?? []);

      if (sceneData.storeAction && sceneData.storeAction !== StoreAction.NONE) {
        const prevCommittedAppState = this.store.snapshot.appState;
        const prevCommittedElements = this.store.snapshot.elements;

        const nextCommittedAppState = sceneData.appState
          ? Object.assign({}, prevCommittedAppState, sceneData.appState) // new instance, with partial appstate applied to previously captured one, including hidden prop inside `prevCommittedAppState`
          : prevCommittedAppState;

        const nextCommittedElements = sceneData.elements
          ? this.store.filterUncomittedElements(
              this.scene.getElementsMapIncludingDeleted(), // Only used to detect uncomitted local elements
              arrayToMap(nextElements), // We expect all (already reconciled) elements
            )
          : prevCommittedElements;

        // WARN: store action always performs deep clone of changed elements, for ephemeral remote updates (i.e. remote dragging, resizing, drawing) we might consider doing something smarter
        // do NOT schedule store actions (execute after re-render), as it might cause unexpected concurrency issues if not handled well
        if (sceneData.storeAction === StoreAction.CAPTURE) {
          this.store.captureIncrement(
            nextCommittedElements,
            nextCommittedAppState,
          );
        } else if (sceneData.storeAction === StoreAction.UPDATE) {
          this.store.updateSnapshot(
            nextCommittedElements,
            nextCommittedAppState,
          );
        }
      }

      if (sceneData.appState) {
        this.setState(sceneData.appState);
      }

      if (sceneData.elements) {
        this.scene.replaceAllElements(nextElements);
      }

      if (sceneData.collaborators) {
        this.setState({ collaborators: sceneData.collaborators });
      }
    },
  );

  private triggerRender = (
    /** force always re-renders canvas even if no change */
    force?: boolean,
  ) => {
    if (force === true) {
      this.scene.triggerUpdate();
    } else {
      this.setState({});
    }
  };

  /**
   * @returns whether the menu was toggled on or off
   */
  public toggleSidebar = ({
    name,
    tab,
    force,
  }: {
    name: SidebarName | null;
    tab?: SidebarTabName;
    force?: boolean;
  }): boolean => {
    let nextName;
    if (force === undefined) {
      nextName =
        this.state.openSidebar?.name === name &&
        this.state.openSidebar?.tab === tab
          ? null
          : name;
    } else {
      nextName = force ? name : null;
    }

    const nextState: AppState["openSidebar"] = nextName
      ? { name: nextName }
      : null;
    if (nextState && tab) {
      nextState.tab = tab;
    }

    this.setState({ openSidebar: nextState });

    return !!nextName;
  };

  private updateCurrentCursorPosition = withBatchedUpdates(
    (event: MouseEvent) => {
      this.lastViewportPosition.x = event.clientX;
      this.lastViewportPosition.y = event.clientY;
    },
  );

  public getEditorUIOffsets = (): Offsets => {
    const toolbarBottom =
      this.excalidrawContainerRef?.current
        ?.querySelector(".App-toolbar")
        ?.getBoundingClientRect()?.bottom ?? 0;
    const sidebarRect = this.excalidrawContainerRef?.current
      ?.querySelector(".sidebar")
      ?.getBoundingClientRect();
    const propertiesPanelRect = this.excalidrawContainerRef?.current
      ?.querySelector(".App-menu__left")
      ?.getBoundingClientRect();

    const PADDING = 16;

    return getLanguage().rtl
      ? {
          top: toolbarBottom + PADDING,
          right:
            Math.max(
              this.state.width -
                (propertiesPanelRect?.left ?? this.state.width),
              0,
            ) + PADDING,
          bottom: PADDING,
          left: Math.max(sidebarRect?.right ?? 0, 0) + PADDING,
        }
      : {
          top: toolbarBottom + PADDING,
          right: Math.max(
            this.state.width -
              (sidebarRect?.left ?? this.state.width) +
              PADDING,
            0,
          ),
          bottom: PADDING,
          left: Math.max(propertiesPanelRect?.right ?? 0, 0) + PADDING,
        };
  };

  // Input handling
  private onKeyDown = withBatchedUpdates(
    (event: React.KeyboardEvent | KeyboardEvent) => {
      // normalize `event.key` when CapsLock is pressed #2372

      if (
        "Proxy" in window &&
        ((!event.shiftKey && /^[A-Z]$/.test(event.key)) ||
          (event.shiftKey && /^[a-z]$/.test(event.key)))
      ) {
        event = new Proxy(event, {
          get(ev: any, prop) {
            const value = ev[prop];
            if (typeof value === "function") {
              // fix for Proxies hijacking `this`
              return value.bind(ev);
            }
            return prop === "key"
              ? // CapsLock inverts capitalization based on ShiftKey, so invert
                // it back
                event.shiftKey
                ? ev.key.toUpperCase()
                : ev.key.toLowerCase()
              : value;
          },
        });
      }

      if (!isInputLike(event.target)) {
        if (
          (event.key === KEYS.ESCAPE || event.key === KEYS.ENTER) &&
          this.state.croppingElementId
        ) {
          this.finishImageCropping();
          return;
        }

        const selectedElements = getSelectedElements(
          this.scene.getNonDeletedElementsMap(),
          this.state,
        );

        if (
          selectedElements.length === 1 &&
          isImageElement(selectedElements[0]) &&
          event.key === KEYS.ENTER
        ) {
          this.startImageCropping(selectedElements[0]);
          return;
        }

        if (
          event.key === KEYS.ESCAPE &&
          this.flowChartCreator.isCreatingChart
        ) {
          this.flowChartCreator.clear();
          this.triggerRender(true);
          return;
        }

        const arrowKeyPressed = isArrowKey(event.key);

        if (event[KEYS.CTRL_OR_CMD] && arrowKeyPressed && !event.shiftKey) {
          event.preventDefault();

          const selectedElements = getSelectedElements(
            this.scene.getNonDeletedElementsMap(),
            this.state,
          );

          if (
            selectedElements.length === 1 &&
            isFlowchartNodeElement(selectedElements[0])
          ) {
            this.flowChartCreator.createNodes(
              selectedElements[0],
              this.scene.getNonDeletedElementsMap(),
              this.state,
              getLinkDirectionFromKey(event.key),
            );
          }

          if (
            this.flowChartCreator.pendingNodes?.length &&
            !isElementCompletelyInViewport(
              this.flowChartCreator.pendingNodes,
              this.canvas.width / window.devicePixelRatio,
              this.canvas.height / window.devicePixelRatio,
              {
                offsetLeft: this.state.offsetLeft,
                offsetTop: this.state.offsetTop,
                scrollX: this.state.scrollX,
                scrollY: this.state.scrollY,
                zoom: this.state.zoom,
              },
              this.scene.getNonDeletedElementsMap(),
              this.getEditorUIOffsets(),
            )
          ) {
            this.scrollToContent(this.flowChartCreator.pendingNodes, {
              animate: true,
              duration: 300,
              fitToContent: true,
              canvasOffsets: this.getEditorUIOffsets(),
            });
          }

          return;
        }

        if (event.altKey) {
          const selectedElements = getSelectedElements(
            this.scene.getNonDeletedElementsMap(),
            this.state,
          );

          if (selectedElements.length === 1 && arrowKeyPressed) {
            event.preventDefault();

            const nextId = this.flowChartNavigator.exploreByDirection(
              selectedElements[0],
              this.scene.getNonDeletedElementsMap(),
              getLinkDirectionFromKey(event.key),
            );

            if (nextId) {
              this.setState((prevState) => ({
                selectedElementIds: makeNextSelectedElementIds(
                  {
                    [nextId]: true,
                  },
                  prevState,
                ),
              }));

              const nextNode = this.scene
                .getNonDeletedElementsMap()
                .get(nextId);

              if (
                nextNode &&
                !isElementCompletelyInViewport(
                  [nextNode],
                  this.canvas.width / window.devicePixelRatio,
                  this.canvas.height / window.devicePixelRatio,
                  {
                    offsetLeft: this.state.offsetLeft,
                    offsetTop: this.state.offsetTop,
                    scrollX: this.state.scrollX,
                    scrollY: this.state.scrollY,
                    zoom: this.state.zoom,
                  },
                  this.scene.getNonDeletedElementsMap(),
                  this.getEditorUIOffsets(),
                )
              ) {
                this.scrollToContent(nextNode, {
                  animate: true,
                  duration: 300,
                  canvasOffsets: this.getEditorUIOffsets(),
                });
              }
            }
            return;
          }
        }
      }

      if (
        event[KEYS.CTRL_OR_CMD] &&
        event.key === KEYS.P &&
        !event.shiftKey &&
        !event.altKey
      ) {
        this.setToast({
          message: t("commandPalette.shortcutHint", {
            shortcut: getShortcutFromShortcutName("commandPalette"),
          }),
        });
        event.preventDefault();
        return;
      }

      if (event[KEYS.CTRL_OR_CMD] && event.key.toLowerCase() === KEYS.V) {
        IS_PLAIN_PASTE = event.shiftKey;
        clearTimeout(IS_PLAIN_PASTE_TIMER);
        // reset (100ms to be safe that we it runs after the ensuing
        // paste event). Though, technically unnecessary to reset since we
        // (re)set the flag before each paste event.
        IS_PLAIN_PASTE_TIMER = window.setTimeout(() => {
          IS_PLAIN_PASTE = false;
        }, 100);
      }

      // prevent browser zoom in input fields
      if (event[KEYS.CTRL_OR_CMD] && isWritableElement(event.target)) {
        if (event.code === CODES.MINUS || event.code === CODES.EQUAL) {
          event.preventDefault();
          return;
        }
      }

      // bail if
      if (
        // inside an input
        (isWritableElement(event.target) &&
          // unless pressing escape (finalize action)
          event.key !== KEYS.ESCAPE) ||
        // or unless using arrows (to move between buttons)
        (isArrowKey(event.key) && isInputLike(event.target))
      ) {
        return;
      }

      if (event.key === KEYS.QUESTION_MARK) {
        this.setState({
          openDialog: { name: "help" },
        });
        return;
      } else if (
        event.key.toLowerCase() === KEYS.E &&
        event.shiftKey &&
        event[KEYS.CTRL_OR_CMD]
      ) {
        event.preventDefault();
        this.setState({ openDialog: { name: "imageExport" } });
        return;
      }

      if (event.key === KEYS.PAGE_UP || event.key === KEYS.PAGE_DOWN) {
        let offset =
          (event.shiftKey ? this.state.width : this.state.height) /
          this.state.zoom.value;
        if (event.key === KEYS.PAGE_DOWN) {
          offset = -offset;
        }
        if (event.shiftKey) {
          this.translateCanvas((state) => ({
            scrollX: state.scrollX + offset,
          }));
        } else {
          this.translateCanvas((state) => ({
            scrollY: state.scrollY + offset,
          }));
        }
      }

      if (this.actionManager.handleKeyDown(event)) {
        return;
      }

      if (this.state.viewModeEnabled) {
        return;
      }

      if (event[KEYS.CTRL_OR_CMD] && this.state.isBindingEnabled) {
        this.setState({ isBindingEnabled: false });
      }

      if (isArrowKey(event.key)) {
        let selectedElements = this.scene.getSelectedElements({
          selectedElementIds: this.state.selectedElementIds,
          includeBoundTextElement: true,
          includeElementsInFrames: true,
        });

        const elbowArrow = selectedElements.find(isElbowArrow) as
          | ExcalidrawArrowElement
          | undefined;

        const arrowIdsToRemove = new Set<string>();

        selectedElements
          .filter(isElbowArrow)
          .filter((arrow) => {
            const startElementNotInSelection =
              arrow.startBinding &&
              !selectedElements.some(
                (el) => el.id === arrow.startBinding?.elementId,
              );
            const endElementNotInSelection =
              arrow.endBinding &&
              !selectedElements.some(
                (el) => el.id === arrow.endBinding?.elementId,
              );
            return startElementNotInSelection || endElementNotInSelection;
          })
          .forEach((arrow) => arrowIdsToRemove.add(arrow.id));

        selectedElements = selectedElements.filter(
          (el) => !arrowIdsToRemove.has(el.id),
        );

        const step =
          (this.getEffectiveGridSize() &&
            (event.shiftKey
              ? ELEMENT_TRANSLATE_AMOUNT
              : this.getEffectiveGridSize())) ||
          (event.shiftKey
            ? ELEMENT_SHIFT_TRANSLATE_AMOUNT
            : ELEMENT_TRANSLATE_AMOUNT);

        let offsetX = 0;
        let offsetY = 0;

        if (event.key === KEYS.ARROW_LEFT) {
          offsetX = -step;
        } else if (event.key === KEYS.ARROW_RIGHT) {
          offsetX = step;
        } else if (event.key === KEYS.ARROW_UP) {
          offsetY = -step;
        } else if (event.key === KEYS.ARROW_DOWN) {
          offsetY = step;
        }

        selectedElements.forEach((element) => {
          mutateElement(element, {
            x: element.x + offsetX,
            y: element.y + offsetY,
          });

          updateBoundElements(element, this.scene.getNonDeletedElementsMap(), {
            simultaneouslyUpdated: selectedElements,
          });
        });

        this.setState({
          suggestedBindings: getSuggestedBindingsForArrows(
            selectedElements.filter(
              (element) => element.id !== elbowArrow?.id || step !== 0,
            ),
            this.scene.getNonDeletedElementsMap(),
          ),
        });

        event.preventDefault();
      } else if (event.key === KEYS.ENTER) {
        const selectedElements = this.scene.getSelectedElements(this.state);
        if (selectedElements.length === 1) {
          const selectedElement = selectedElements[0];
          if (event[KEYS.CTRL_OR_CMD]) {
            if (isLinearElement(selectedElement)) {
              if (
                !this.state.editingLinearElement ||
                this.state.editingLinearElement.elementId !==
                  selectedElements[0].id
              ) {
                this.store.shouldCaptureIncrement();
                if (!isElbowArrow(selectedElement)) {
                  this.setState({
                    editingLinearElement: new LinearElementEditor(
                      selectedElement,
                    ),
                  });
                }
              }
            }
          } else if (
            isTextElement(selectedElement) ||
            isValidTextContainer(selectedElement)
          ) {
            let container;
            if (!isTextElement(selectedElement)) {
              container = selectedElement as ExcalidrawTextContainer;
            }
            const midPoint = getContainerCenter(
              selectedElement,
              this.state,
              this.scene.getNonDeletedElementsMap(),
            );
            const sceneX = midPoint.x;
            const sceneY = midPoint.y;
            this.startTextEditing({
              sceneX,
              sceneY,
              container,
            });
            event.preventDefault();
            return;
          } else if (isFrameLikeElement(selectedElement)) {
            this.setState({
              editingFrame: selectedElement.id,
            });
          }
        }
      } else if (
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey &&
        !this.state.newElement &&
        !this.state.selectionElement &&
        !this.state.selectedElementsAreBeingDragged
      ) {
        const shape = findShapeByKey(event.key);
        if (shape) {
          if (this.state.activeTool.type !== shape) {
            trackEvent(
              "toolbar",
              shape,
              `keyboard (${
                this.device.editor.isMobile ? "mobile" : "desktop"
              })`,
            );
          }
          if (shape === "arrow" && this.state.activeTool.type === "arrow") {
            this.setState((prevState) => ({
              currentItemArrowType:
                prevState.currentItemArrowType === ARROW_TYPE.sharp
                  ? ARROW_TYPE.round
                  : prevState.currentItemArrowType === ARROW_TYPE.round
                  ? ARROW_TYPE.elbow
                  : ARROW_TYPE.sharp,
            }));
          }
          this.setActiveTool({ type: shape });
          event.stopPropagation();
        } else if (event.key === KEYS.Q) {
          this.toggleLock("keyboard");
          event.stopPropagation();
        }
      }
      if (event.key === KEYS.SPACE && gesture.pointers.size === 0) {
        isHoldingSpace = true;
        setCursor(this.interactiveCanvas, CURSOR_TYPE.GRAB);
        event.preventDefault();
      }

      if (
        (event.key === KEYS.G || event.key === KEYS.S) &&
        !event.altKey &&
        !event[KEYS.CTRL_OR_CMD]
      ) {
        const selectedElements = this.scene.getSelectedElements(this.state);
        if (
          this.state.activeTool.type === "selection" &&
          !selectedElements.length
        ) {
          return;
        }

        if (
          event.key === KEYS.G &&
          (hasBackground(this.state.activeTool.type) ||
            selectedElements.some((element) => hasBackground(element.type)))
        ) {
          this.setState({ openPopup: "elementBackground" });
          event.stopPropagation();
        }
        if (event.key === KEYS.S) {
          this.setState({ openPopup: "elementStroke" });
          event.stopPropagation();
        }
      }

      if (
        !event[KEYS.CTRL_OR_CMD] &&
        event.shiftKey &&
        event.key.toLowerCase() === KEYS.F
      ) {
        const selectedElements = this.scene.getSelectedElements(this.state);

        if (
          this.state.activeTool.type === "selection" &&
          !selectedElements.length
        ) {
          return;
        }

        if (
          this.state.activeTool.type === "text" ||
          selectedElements.find(
            (element) =>
              isTextElement(element) ||
              getBoundTextElement(
                element,
                this.scene.getNonDeletedElementsMap(),
              ),
          )
        ) {
          event.preventDefault();
          this.setState({ openPopup: "fontFamily" });
        }
      }

      if (event.key === KEYS.K && !event.altKey && !event[KEYS.CTRL_OR_CMD]) {
        if (this.state.activeTool.type === "laser") {
          this.setActiveTool({ type: "selection" });
        } else {
          this.setActiveTool({ type: "laser" });
        }
        return;
      }

      if (
        event[KEYS.CTRL_OR_CMD] &&
        (event.key === KEYS.BACKSPACE || event.key === KEYS.DELETE)
      ) {
        jotaiStore.set(activeConfirmDialogAtom, "clearCanvas");
      }

      // eye dropper
      // -----------------------------------------------------------------------
      const lowerCased = event.key.toLocaleLowerCase();
      const isPickingStroke = lowerCased === KEYS.S && event.shiftKey;
      const isPickingBackground =
        event.key === KEYS.I || (lowerCased === KEYS.G && event.shiftKey);

      if (isPickingStroke || isPickingBackground) {
        this.openEyeDropper({
          type: isPickingStroke ? "stroke" : "background",
        });
      }
      // -----------------------------------------------------------------------
    },
  );

  private onKeyUp = withBatchedUpdates((event: KeyboardEvent) => {
    if (event.key === KEYS.SPACE) {
      if (this.state.viewModeEnabled) {
        setCursor(this.interactiveCanvas, CURSOR_TYPE.GRAB);
      } else if (this.state.activeTool.type === "selection") {
        resetCursor(this.interactiveCanvas);
      } else {
        setCursorForShape(this.interactiveCanvas, this.state);
        this.setState({
          selectedElementIds: makeNextSelectedElementIds({}, this.state),
          selectedGroupIds: {},
          editingGroupId: null,
          activeEmbeddable: null,
        });
      }
      isHoldingSpace = false;
    }
    if (!event[KEYS.CTRL_OR_CMD] && !this.state.isBindingEnabled) {
      this.setState({ isBindingEnabled: true });
    }
    if (isArrowKey(event.key)) {
      bindOrUnbindLinearElements(
        this.scene.getSelectedElements(this.state).filter(isLinearElement),
        this.scene.getNonDeletedElementsMap(),
        this.scene.getNonDeletedElements(),
        this.scene,
        isBindingEnabled(this.state),
        this.state.selectedLinearElement?.selectedPointsIndices ?? [],
      );
      this.setState({ suggestedBindings: [] });
    }

    if (!event.altKey) {
      if (this.flowChartNavigator.isExploring) {
        this.flowChartNavigator.clear();
        this.syncActionResult({ storeAction: StoreAction.CAPTURE });
      }
    }

    if (!event[KEYS.CTRL_OR_CMD]) {
      if (this.flowChartCreator.isCreatingChart) {
        if (this.flowChartCreator.pendingNodes?.length) {
          this.scene.insertElements(this.flowChartCreator.pendingNodes);
        }

        const firstNode = this.flowChartCreator.pendingNodes?.[0];

        if (firstNode) {
          this.setState((prevState) => ({
            selectedElementIds: makeNextSelectedElementIds(
              {
                [firstNode.id]: true,
              },
              prevState,
            ),
          }));

          if (
            !isElementCompletelyInViewport(
              [firstNode],
              this.canvas.width / window.devicePixelRatio,
              this.canvas.height / window.devicePixelRatio,
              {
                offsetLeft: this.state.offsetLeft,
                offsetTop: this.state.offsetTop,
                scrollX: this.state.scrollX,
                scrollY: this.state.scrollY,
                zoom: this.state.zoom,
              },
              this.scene.getNonDeletedElementsMap(),
              this.getEditorUIOffsets(),
            )
          ) {
            this.scrollToContent(firstNode, {
              animate: true,
              duration: 300,
              canvasOffsets: this.getEditorUIOffsets(),
            });
          }
        }

        this.flowChartCreator.clear();
        this.syncActionResult({ storeAction: StoreAction.CAPTURE });
      }
    }
  });

  // We purposely widen the `tool` type so this helper can be called with
  // any tool without having to type check it
  private isToolSupported = <T extends ToolType | "custom">(tool: T) => {
    return (
      this.props.UIOptions.tools?.[
        tool as Extract<T, keyof AppProps["UIOptions"]["tools"]>
      ] !== false
    );
  };

  setActiveTool = (
    tool: (
      | (
          | { type: Exclude<ToolType, "image"> }
          | {
              type: Extract<ToolType, "image">;
              insertOnCanvasDirectly?: boolean;
            }
        )
      | { type: "custom"; customType: string }
    ) & { locked?: boolean },
  ) => {
    if (!this.isToolSupported(tool.type)) {
      console.warn(
        `"${tool.type}" tool is disabled via "UIOptions.canvasActions.tools.${tool.type}"`,
      );
      return;
    }

    const nextActiveTool = updateActiveTool(this.state, tool);
    if (nextActiveTool.type === "hand") {
      setCursor(this.interactiveCanvas, CURSOR_TYPE.GRAB);
    } else if (!isHoldingSpace) {
      setCursorForShape(this.interactiveCanvas, this.state);
    }
    if (isToolIcon(document.activeElement)) {
      this.focusContainer();
    }
    if (!isLinearElementType(nextActiveTool.type)) {
      this.setState({ suggestedBindings: [] });
    }
    if (nextActiveTool.type === "image") {
      this.onImageAction({
        insertOnCanvasDirectly:
          (tool.type === "image" && tool.insertOnCanvasDirectly) ?? false,
      });
    }

    this.setState((prevState) => {
      const commonResets = {
        snapLines: prevState.snapLines.length ? [] : prevState.snapLines,
        originSnapOffset: null,
        activeEmbeddable: null,
      } as const;

      if (nextActiveTool.type === "freedraw") {
        this.store.shouldCaptureIncrement();
      }

      if (nextActiveTool.type !== "selection") {
        return {
          ...prevState,
          activeTool: nextActiveTool,
          selectedElementIds: makeNextSelectedElementIds({}, prevState),
          selectedGroupIds: makeNextSelectedElementIds({}, prevState),
          editingGroupId: null,
          multiElement: null,
          ...commonResets,
        };
      }
      return {
        ...prevState,
        activeTool: nextActiveTool,
        ...commonResets,
      };
    });
  };

  setOpenDialog = (dialogType: AppState["openDialog"]) => {
    this.setState({ openDialog: dialogType });
  };

  private setCursor = (cursor: string) => {
    setCursor(this.interactiveCanvas, cursor);
  };

  private resetCursor = () => {
    resetCursor(this.interactiveCanvas);
  };
  /**
   * returns whether user is making a gesture with >= 2 fingers (points)
   * on o touch screen (not on a trackpad). Currently only relates to Darwin
   * (iOS/iPadOS,MacOS), but may work on other devices in the future if
   * GestureEvent is standardized.
   */
  private isTouchScreenMultiTouchGesture = () => {
    // we don't want to deselect when using trackpad, and multi-point gestures
    // only work on touch screens, so checking for >= pointers means we're on a
    // touchscreen
    return gesture.pointers.size >= 2;
  };

  public getName = () => {
    return (
      this.state.name ||
      this.props.name ||
      `${t("labels.untitled")}-${getDateTime()}`
    );
  };

  // fires only on Safari
  private onGestureStart = withBatchedUpdates((event: GestureEvent) => {
    event.preventDefault();

    // we only want to deselect on touch screens because user may have selected
    // elements by mistake while zooming
    if (this.isTouchScreenMultiTouchGesture()) {
      this.setState({
        selectedElementIds: makeNextSelectedElementIds({}, this.state),
        activeEmbeddable: null,
      });
    }
    gesture.initialScale = this.state.zoom.value;
  });

  // fires only on Safari
  private onGestureChange = withBatchedUpdates((event: GestureEvent) => {
    event.preventDefault();

    // onGestureChange only has zoom factor but not the center.
    // If we're on iPad or iPhone, then we recognize multi-touch and will
    // zoom in at the right location in the touchmove handler
    // (handleCanvasPointerMove).
    //
    // On Macbook trackpad, we don't have those events so will zoom in at the
    // current location instead.
    //
    // As such, bail from this handler on touch devices.
    if (this.isTouchScreenMultiTouchGesture()) {
      return;
    }

    const initialScale = gesture.initialScale;
    if (initialScale) {
      this.setState((state) => ({
        ...getStateForZoom(
          {
            viewportX: this.lastViewportPosition.x,
            viewportY: this.lastViewportPosition.y,
            nextZoom: getNormalizedZoom(initialScale * event.scale),
          },
          state,
        ),
      }));
    }
  });

  // fires only on Safari
  private onGestureEnd = withBatchedUpdates((event: GestureEvent) => {
    event.preventDefault();
    // reselect elements only on touch screens (see onGestureStart)
    if (this.isTouchScreenMultiTouchGesture()) {
      this.setState({
        previousSelectedElementIds: {},
        selectedElementIds: makeNextSelectedElementIds(
          this.state.previousSelectedElementIds,
          this.state,
        ),
      });
    }
    gesture.initialScale = null;
  });

  private handleTextWysiwyg(
    element: ExcalidrawTextElement,
    {
      isExistingElement = false,
    }: {
      isExistingElement?: boolean;
    },
  ) {
    const elementsMap = this.scene.getElementsMapIncludingDeleted();

    const updateElement = (nextOriginalText: string, isDeleted: boolean) => {
      this.scene.replaceAllElements([
        // Not sure why we include deleted elements as well hence using deleted elements map
        ...this.scene.getElementsIncludingDeleted().map((_element) => {
          if (_element.id === element.id && isTextElement(_element)) {
            return newElementWith(_element, {
              originalText: nextOriginalText,
              isDeleted: isDeleted ?? _element.isDeleted,
              // returns (wrapped) text and new dimensions
              ...refreshTextDimensions(
                _element,
                getContainerElement(_element, elementsMap),
                elementsMap,
                nextOriginalText,
              ),
            });
          }
          return _element;
        }),
      ]);
    };

    textWysiwyg({
      id: element.id,
      canvas: this.canvas,
      getViewportCoords: (x, y) => {
        const { x: viewportX, y: viewportY } = sceneCoordsToViewportCoords(
          {
            sceneX: x,
            sceneY: y,
          },
          this.state,
        );
        return [
          viewportX - this.state.offsetLeft,
          viewportY - this.state.offsetTop,
        ];
      },
      onChange: withBatchedUpdates((nextOriginalText) => {
        updateElement(nextOriginalText, false);
        if (isNonDeletedElement(element)) {
          updateBoundElements(element, this.scene.getNonDeletedElementsMap());
        }
      }),
      onSubmit: withBatchedUpdates(({ viaKeyboard, nextOriginalText }) => {
        const isDeleted = !nextOriginalText.trim();
        updateElement(nextOriginalText, isDeleted);
        // select the created text element only if submitting via keyboard
        // (when submitting via click it should act as signal to deselect)
        if (!isDeleted && viaKeyboard) {
          const elementIdToSelect = element.containerId
            ? element.containerId
            : element.id;

          // needed to ensure state is updated before "finalize" action
          // that's invoked on keyboard-submit as well
          // TODO either move this into finalize as well, or handle all state
          // updates in one place, skipping finalize action
          flushSync(() => {
            this.setState((prevState) => ({
              selectedElementIds: makeNextSelectedElementIds(
                {
                  ...prevState.selectedElementIds,
                  [elementIdToSelect]: true,
                },
                prevState,
              ),
            }));
          });
        }
        if (isDeleted) {
          fixBindingsAfterDeletion(this.scene.getNonDeletedElements(), [
            element,
          ]);
        }
        if (!isDeleted || isExistingElement) {
          this.store.shouldCaptureIncrement();
        }

        flushSync(() => {
          this.setState({
            newElement: null,
            editingTextElement: null,
          });
        });

        if (this.state.activeTool.locked) {
          setCursorForShape(this.interactiveCanvas, this.state);
        }

        this.focusContainer();
      }),
      element,
      excalidrawContainer: this.excalidrawContainerRef.current,
      app: this,
      // when text is selected, it's hard (at least on iOS) to re-position the
      // caret (i.e. deselect). There's not much use for always selecting
      // the text on edit anyway (and users can select-all from contextmenu
      // if needed)
      autoSelect: !this.device.isTouchScreen,
    });
    // deselect all other elements when inserting text
    this.deselectElements();

    // do an initial update to re-initialize element position since we were
    // modifying element's x/y for sake of editor (case: syncing to remote)
    updateElement(element.originalText, false);
  }

  private deselectElements() {
    this.setState({
      selectedElementIds: makeNextSelectedElementIds({}, this.state),
      selectedGroupIds: {},
      editingGroupId: null,
      activeEmbeddable: null,
    });
  }

  private getTextElementAtPosition(
    x: number,
    y: number,
  ): NonDeleted<ExcalidrawTextElement> | null {
    const element = this.getElementAtPosition(x, y, {
      includeBoundTextElement: true,
    });
    if (element && isTextElement(element) && !element.isDeleted) {
      return element;
    }
    return null;
  }

  private getElementAtPosition(
    x: number,
    y: number,
    opts?: {
      preferSelected?: boolean;
      includeBoundTextElement?: boolean;
      includeLockedElements?: boolean;
    },
  ): NonDeleted<ExcalidrawElement> | null {
    const allHitElements = this.getElementsAtPosition(
      x,
      y,
      opts?.includeBoundTextElement,
      opts?.includeLockedElements,
    );

    if (allHitElements.length > 1) {
      if (opts?.preferSelected) {
        for (let index = allHitElements.length - 1; index > -1; index--) {
          if (this.state.selectedElementIds[allHitElements[index].id]) {
            return allHitElements[index];
          }
        }
      }
      const elementWithHighestZIndex =
        allHitElements[allHitElements.length - 1];

      // If we're hitting element with highest z-index only on its bounding box
      // while also hitting other element figure, the latter should be considered.
      return hitElementItself({
        x,
        y,
        element: elementWithHighestZIndex,
        shape: getElementShape(
          elementWithHighestZIndex,
          this.scene.getNonDeletedElementsMap(),
        ),
        // when overlapping, we would like to be more precise
        // this also avoids the need to update past tests
        threshold: this.getElementHitThreshold() / 2,
        frameNameBound: isFrameLikeElement(elementWithHighestZIndex)
          ? this.frameNameBoundsCache.get(elementWithHighestZIndex)
          : null,
      })
        ? elementWithHighestZIndex
        : allHitElements[allHitElements.length - 2];
    }
    if (allHitElements.length === 1) {
      return allHitElements[0];
    }

    return null;
  }

  private getElementsAtPosition(
    x: number,
    y: number,
    includeBoundTextElement: boolean = false,
    includeLockedElements: boolean = false,
  ): NonDeleted<ExcalidrawElement>[] {
    const iframeLikes: Ordered<ExcalidrawIframeElement>[] = [];

    const elementsMap = this.scene.getNonDeletedElementsMap();

    const elements = (
      includeBoundTextElement && includeLockedElements
        ? this.scene.getNonDeletedElements()
        : this.scene
            .getNonDeletedElements()
            .filter(
              (element) =>
                (includeLockedElements || !element.locked) &&
                (includeBoundTextElement ||
                  !(isTextElement(element) && element.containerId)),
            )
    )
      .filter((el) => this.hitElement(x, y, el))
      .filter((element) => {
        // hitting a frame's element from outside the frame is not considered a hit
        const containingFrame = getContainingFrame(element, elementsMap);
        return containingFrame &&
          this.state.frameRendering.enabled &&
          this.state.frameRendering.clip
          ? isCursorInFrame({ x, y }, containingFrame, elementsMap)
          : true;
      })
      .filter((el) => {
        // The parameter elements comes ordered from lower z-index to higher.
        // We want to preserve that order on the returned array.
        // Exception being embeddables which should be on top of everything else in
        // terms of hit testing.
        if (isIframeElement(el)) {
          iframeLikes.push(el);
          return false;
        }
        return true;
      })
      .concat(iframeLikes) as NonDeleted<ExcalidrawElement>[];

    return elements;
  }

  private getElementHitThreshold() {
    return DEFAULT_COLLISION_THRESHOLD / this.state.zoom.value;
  }

  private hitElement(
    x: number,
    y: number,
    element: ExcalidrawElement,
    considerBoundingBox = true,
  ) {
    // if the element is selected, then hit test is done against its bounding box
    if (
      considerBoundingBox &&
      this.state.selectedElementIds[element.id] &&
      shouldShowBoundingBox([element], this.state)
    ) {
      const selectionShape = getSelectionBoxShape(
        element,
        this.scene.getNonDeletedElementsMap(),
        isImageElement(element) ? 0 : this.getElementHitThreshold(),
      );

      return isPointInShape(pointFrom(x, y), selectionShape);
    }

    // take bound text element into consideration for hit collision as well
    const hitBoundTextOfElement = hitElementBoundText(
      x,
      y,
      getBoundTextShape(element, this.scene.getNonDeletedElementsMap()),
    );
    if (hitBoundTextOfElement) {
      return true;
    }

    return hitElementItself({
      x,
      y,
      element,
      shape: getElementShape(element, this.scene.getNonDeletedElementsMap()),
      threshold: this.getElementHitThreshold(),
      frameNameBound: isFrameLikeElement(element)
        ? this.frameNameBoundsCache.get(element)
        : null,
    });
  }

  private getTextBindableContainerAtPosition(x: number, y: number) {
    const elements = this.scene.getNonDeletedElements();
    const selectedElements = this.scene.getSelectedElements(this.state);
    if (selectedElements.length === 1) {
      return isTextBindableContainer(selectedElements[0], false)
        ? selectedElements[0]
        : null;
    }
    let hitElement = null;
    // We need to do hit testing from front (end of the array) to back (beginning of the array)
    for (let index = elements.length - 1; index >= 0; --index) {
      if (elements[index].isDeleted) {
        continue;
      }
      const [x1, y1, x2, y2] = getElementAbsoluteCoords(
        elements[index],
        this.scene.getNonDeletedElementsMap(),
      );
      if (
        isArrowElement(elements[index]) &&
        hitElementItself({
          x,
          y,
          element: elements[index],
          shape: getElementShape(
            elements[index],
            this.scene.getNonDeletedElementsMap(),
          ),
          threshold: this.getElementHitThreshold(),
        })
      ) {
        hitElement = elements[index];
        break;
      } else if (x1 < x && x < x2 && y1 < y && y < y2) {
        hitElement = elements[index];
        break;
      }
    }

    return isTextBindableContainer(hitElement, false) ? hitElement : null;
  }

  private startTextEditing = ({
    sceneX,
    sceneY,
    insertAtParentCenter = true,
    container,
    autoEdit = true,
  }: {
    /** X position to insert text at */
    sceneX: number;
    /** Y position to insert text at */
    sceneY: number;
    /** whether to attempt to insert at element center if applicable */
    insertAtParentCenter?: boolean;
    container?: ExcalidrawTextContainer | null;
    autoEdit?: boolean;
  }) => {
    let shouldBindToContainer = false;

    let parentCenterPosition =
      insertAtParentCenter &&
      this.getTextWysiwygSnappedToCenterPosition(
        sceneX,
        sceneY,
        this.state,
        container,
      );
    if (container && parentCenterPosition) {
      const boundTextElementToContainer = getBoundTextElement(
        container,
        this.scene.getNonDeletedElementsMap(),
      );
      if (!boundTextElementToContainer) {
        shouldBindToContainer = true;
      }
    }
    let existingTextElement: NonDeleted<ExcalidrawTextElement> | null = null;

    const selectedElements = this.scene.getSelectedElements(this.state);

    if (selectedElements.length === 1) {
      if (isTextElement(selectedElements[0])) {
        existingTextElement = selectedElements[0];
      } else if (container) {
        existingTextElement = getBoundTextElement(
          selectedElements[0],
          this.scene.getNonDeletedElementsMap(),
        );
      } else {
        existingTextElement = this.getTextElementAtPosition(sceneX, sceneY);
      }
    } else {
      existingTextElement = this.getTextElementAtPosition(sceneX, sceneY);
    }

    const fontFamily =
      existingTextElement?.fontFamily || this.state.currentItemFontFamily;

    const lineHeight =
      existingTextElement?.lineHeight || getLineHeight(fontFamily);
    const fontSize = this.state.currentItemFontSize;

    if (
      !existingTextElement &&
      shouldBindToContainer &&
      container &&
      !isArrowElement(container)
    ) {
      const fontString = {
        fontSize,
        fontFamily,
      };
      const minWidth = getApproxMinLineWidth(
        getFontString(fontString),
        lineHeight,
      );
      const minHeight = getApproxMinLineHeight(fontSize, lineHeight);
      const newHeight = Math.max(container.height, minHeight);
      const newWidth = Math.max(container.width, minWidth);
      mutateElement(container, { height: newHeight, width: newWidth });
      sceneX = container.x + newWidth / 2;
      sceneY = container.y + newHeight / 2;
      if (parentCenterPosition) {
        parentCenterPosition = this.getTextWysiwygSnappedToCenterPosition(
          sceneX,
          sceneY,
          this.state,
          container,
        );
      }
    }

    const topLayerFrame = this.getTopLayerFrameAtSceneCoords({
      x: sceneX,
      y: sceneY,
    });

    const element = existingTextElement
      ? existingTextElement
      : newTextElement({
          x: parentCenterPosition
            ? parentCenterPosition.elementCenterX
            : sceneX,
          y: parentCenterPosition
            ? parentCenterPosition.elementCenterY
            : sceneY,
          strokeColor: this.state.currentItemStrokeColor,
          backgroundColor: this.state.currentItemBackgroundColor,
          fillStyle: this.state.currentItemFillStyle,
          strokeWidth: this.state.currentItemStrokeWidth,
          strokeStyle: this.state.currentItemStrokeStyle,
          roughness: this.state.currentItemRoughness,
          opacity: this.state.currentItemOpacity,
          text: "",
          fontSize,
          fontFamily,
          textAlign: parentCenterPosition
            ? "center"
            : this.state.currentItemTextAlign,
          verticalAlign: parentCenterPosition
            ? VERTICAL_ALIGN.MIDDLE
            : DEFAULT_VERTICAL_ALIGN,
          containerId: shouldBindToContainer ? container?.id : undefined,
          groupIds: container?.groupIds ?? [],
          lineHeight,
          angle: container?.angle ?? (0 as Radians),
          frameId: topLayerFrame ? topLayerFrame.id : null,
        });

    if (!existingTextElement && shouldBindToContainer && container) {
      mutateElement(container, {
        boundElements: (container.boundElements || []).concat({
          type: "text",
          id: element.id,
        }),
      });
    }
    this.setState({ editingTextElement: element });

    if (!existingTextElement) {
      if (container && shouldBindToContainer) {
        const containerIndex = this.scene.getElementIndex(container.id);
        this.scene.insertElementAtIndex(element, containerIndex + 1);
      } else {
        this.scene.insertElement(element);
      }
    }

    if (autoEdit || existingTextElement || container) {
      this.handleTextWysiwyg(element, {
        isExistingElement: !!existingTextElement,
      });
    } else {
      this.setState({
        newElement: element,
        multiElement: null,
      });
    }
  };

  private startImageCropping = (image: ExcalidrawImageElement) => {
    this.store.shouldCaptureIncrement();
    this.setState({
      croppingElementId: image.id,
    });
  };

  private finishImageCropping = () => {
    if (this.state.croppingElementId) {
      this.store.shouldCaptureIncrement();
      this.setState({
        croppingElementId: null,
      });
    }
  };

  private handleCanvasDoubleClick = (
    event: React.MouseEvent<HTMLCanvasElement>,
  ) => {
    // case: double-clicking with arrow/line tool selected would both create
    // text and enter multiElement mode
    if (this.state.multiElement) {
      return;
    }
    // we should only be able to double click when mode is selection
    if (this.state.activeTool.type !== "selection") {
      return;
    }

    const selectedElements = this.scene.getSelectedElements(this.state);

    if (selectedElements.length === 1 && isLinearElement(selectedElements[0])) {
      if (
        event[KEYS.CTRL_OR_CMD] &&
        (!this.state.editingLinearElement ||
          this.state.editingLinearElement.elementId !==
            selectedElements[0].id) &&
        !isElbowArrow(selectedElements[0])
      ) {
        this.store.shouldCaptureIncrement();
        this.setState({
          editingLinearElement: new LinearElementEditor(selectedElements[0]),
        });
        return;
      }
    }

    if (selectedElements.length === 1 && isImageElement(selectedElements[0])) {
      this.startImageCropping(selectedElements[0]);
      return;
    }

    resetCursor(this.interactiveCanvas);

    let { x: sceneX, y: sceneY } = viewportCoordsToSceneCoords(
      event,
      this.state,
    );

    const selectedGroupIds = getSelectedGroupIds(this.state);

    if (selectedGroupIds.length > 0) {
      const hitElement = this.getElementAtPosition(sceneX, sceneY);

      const selectedGroupId =
        hitElement &&
        getSelectedGroupIdForElement(hitElement, this.state.selectedGroupIds);

      if (selectedGroupId) {
        this.store.shouldCaptureIncrement();
        this.setState((prevState) => ({
          ...prevState,
          ...selectGroupsForSelectedElements(
            {
              editingGroupId: selectedGroupId,
              selectedElementIds: { [hitElement!.id]: true },
            },
            this.scene.getNonDeletedElements(),
            prevState,
            this,
          ),
        }));
        return;
      }
    }

    resetCursor(this.interactiveCanvas);
    if (!event[KEYS.CTRL_OR_CMD] && !this.state.viewModeEnabled) {
      const hitElement = this.getElementAtPosition(sceneX, sceneY);

      if (isIframeLikeElement(hitElement)) {
        this.setState({
          activeEmbeddable: { element: hitElement, state: "active" },
        });
        return;
      }

      const container = this.getTextBindableContainerAtPosition(sceneX, sceneY);

      if (container) {
        if (
          hasBoundTextElement(container) ||
          !isTransparent(container.backgroundColor) ||
          hitElementItself({
            x: sceneX,
            y: sceneY,
            element: container,
            shape: getElementShape(
              container,
              this.scene.getNonDeletedElementsMap(),
            ),
            threshold: this.getElementHitThreshold(),
          })
        ) {
          const midPoint = getContainerCenter(
            container,
            this.state,
            this.scene.getNonDeletedElementsMap(),
          );

          sceneX = midPoint.x;
          sceneY = midPoint.y;
        }
      }

      this.startTextEditing({
        sceneX,
        sceneY,
        insertAtParentCenter: !event.altKey,
        container,
      });
    }
  };

  private getElementLinkAtPosition = (
    scenePointer: Readonly<{ x: number; y: number }>,
    hitElement: NonDeletedExcalidrawElement | null,
  ): ExcalidrawElement | undefined => {
    // Reversing so we traverse the elements in decreasing order
    // of z-index
    const elements = this.scene.getNonDeletedElements().slice().reverse();
    let hitElementIndex = Infinity;

    return elements.find((element, index) => {
      if (hitElement && element.id === hitElement.id) {
        hitElementIndex = index;
      }
      return (
        element.link &&
        index <= hitElementIndex &&
        isPointHittingLink(
          element,
          this.scene.getNonDeletedElementsMap(),
          this.state,
          pointFrom(scenePointer.x, scenePointer.y),
          this.device.editor.isMobile,
        )
      );
    });
  };

  private redirectToLink = (
    event: React.PointerEvent<HTMLCanvasElement>,
    isTouchScreen: boolean,
  ) => {
    const draggedDistance = pointDistance(
      pointFrom(
        this.lastPointerDownEvent!.clientX,
        this.lastPointerDownEvent!.clientY,
      ),
      pointFrom(
        this.lastPointerUpEvent!.clientX,
        this.lastPointerUpEvent!.clientY,
      ),
    );
    if (
      !this.hitLinkElement ||
      // For touch screen allow dragging threshold else strict check
      (isTouchScreen && draggedDistance > DRAGGING_THRESHOLD) ||
      (!isTouchScreen && draggedDistance !== 0)
    ) {
      return;
    }
    const lastPointerDownCoords = viewportCoordsToSceneCoords(
      this.lastPointerDownEvent!,
      this.state,
    );
    const elementsMap = this.scene.getNonDeletedElementsMap();
    const lastPointerDownHittingLinkIcon = isPointHittingLink(
      this.hitLinkElement,
      elementsMap,
      this.state,
      pointFrom(lastPointerDownCoords.x, lastPointerDownCoords.y),
      this.device.editor.isMobile,
    );
    const lastPointerUpCoords = viewportCoordsToSceneCoords(
      this.lastPointerUpEvent!,
      this.state,
    );
    const lastPointerUpHittingLinkIcon = isPointHittingLink(
      this.hitLinkElement,
      elementsMap,
      this.state,
      pointFrom(lastPointerUpCoords.x, lastPointerUpCoords.y),
      this.device.editor.isMobile,
    );
    if (lastPointerDownHittingLinkIcon && lastPointerUpHittingLinkIcon) {
      let url = this.hitLinkElement.link;
      if (url) {
        url = normalizeLink(url);
        let customEvent;
        if (this.props.onLinkOpen) {
          customEvent = wrapEvent(EVENT.EXCALIDRAW_LINK, event.nativeEvent);
          this.props.onLinkOpen(
            {
              ...this.hitLinkElement,
              link: url,
            },
            customEvent,
          );
        }
        if (!customEvent?.defaultPrevented) {
          const target = isLocalLink(url) ? "_self" : "_blank";
          const newWindow = window.open(undefined, target);
          // https://mathiasbynens.github.io/rel-noopener/
          if (newWindow) {
            newWindow.opener = null;
            newWindow.location = url;
          }
        }
      }
    }
  };

  private getTopLayerFrameAtSceneCoords = (sceneCoords: {
    x: number;
    y: number;
  }) => {
    const elementsMap = this.scene.getNonDeletedElementsMap();
    const frames = this.scene
      .getNonDeletedFramesLikes()
      .filter((frame): frame is ExcalidrawFrameLikeElement =>
        isCursorInFrame(sceneCoords, frame, elementsMap),
      );

    return frames.length ? frames[frames.length - 1] : null;
  };

  private handleCanvasPointerMove = (
    event: React.PointerEvent<HTMLCanvasElement>,
  ) => {
    this.savePointer(event.clientX, event.clientY, this.state.cursorButton);
    this.lastPointerMoveEvent = event.nativeEvent;

    if (gesture.pointers.has(event.pointerId)) {
      gesture.pointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
    }

    const initialScale = gesture.initialScale;
    if (
      gesture.pointers.size === 2 &&
      gesture.lastCenter &&
      initialScale &&
      gesture.initialDistance
    ) {
      const center = getCenter(gesture.pointers);
      const deltaX = center.x - gesture.lastCenter.x;
      const deltaY = center.y - gesture.lastCenter.y;
      gesture.lastCenter = center;

      const distance = getDistance(Array.from(gesture.pointers.values()));
      const scaleFactor =
        this.state.activeTool.type === "freedraw" && this.state.penMode
          ? 1
          : distance / gesture.initialDistance;

      const nextZoom = scaleFactor
        ? getNormalizedZoom(initialScale * scaleFactor)
        : this.state.zoom.value;

      this.setState((state) => {
        const zoomState = getStateForZoom(
          {
            viewportX: center.x,
            viewportY: center.y,
            nextZoom,
          },
          state,
        );

        this.translateCanvas({
          zoom: zoomState.zoom,
          // 2x multiplier is just a magic number that makes this work correctly
          // on touchscreen devices (note: if we get report that panning is slower/faster
          // than actual movement, consider swapping with devicePixelRatio)
          scrollX: zoomState.scrollX + 2 * (deltaX / nextZoom),
          scrollY: zoomState.scrollY + 2 * (deltaY / nextZoom),
          shouldCacheIgnoreZoom: true,
        });
      });
      this.resetShouldCacheIgnoreZoomDebounced();
    } else {
      gesture.lastCenter =
        gesture.initialDistance =
        gesture.initialScale =
          null;
    }

    if (
      isHoldingSpace ||
      isPanning ||
      isDraggingScrollBar ||
      isHandToolActive(this.state)
    ) {
      return;
    }

    const isPointerOverScrollBars = isOverScrollBars(
      currentScrollBars,
      event.clientX - this.state.offsetLeft,
      event.clientY - this.state.offsetTop,
    );
    const isOverScrollBar = isPointerOverScrollBars.isOverEither;
    if (
      !this.state.newElement &&
      !this.state.selectionElement &&
      !this.state.selectedElementsAreBeingDragged &&
      !this.state.multiElement
    ) {
      if (isOverScrollBar) {
        resetCursor(this.interactiveCanvas);
      } else {
        setCursorForShape(this.interactiveCanvas, this.state);
      }
    }

    const scenePointer = viewportCoordsToSceneCoords(event, this.state);
    const { x: scenePointerX, y: scenePointerY } = scenePointer;

    if (
      !this.state.newElement &&
      isActiveToolNonLinearSnappable(this.state.activeTool.type)
    ) {
      const { originOffset, snapLines } = getSnapLinesAtPointer(
        this.scene.getNonDeletedElements(),
        this,
        {
          x: scenePointerX,
          y: scenePointerY,
        },
        event,
        this.scene.getNonDeletedElementsMap(),
      );

      this.setState((prevState) => {
        const nextSnapLines = updateStable(prevState.snapLines, snapLines);
        const nextOriginOffset = prevState.originSnapOffset
          ? updateStable(prevState.originSnapOffset, originOffset)
          : originOffset;

        if (
          prevState.snapLines === nextSnapLines &&
          prevState.originSnapOffset === nextOriginOffset
        ) {
          return null;
        }
        return {
          snapLines: nextSnapLines,
          originSnapOffset: nextOriginOffset,
        };
      });
    } else if (
      !this.state.newElement &&
      !this.state.selectedElementsAreBeingDragged &&
      !this.state.selectionElement
    ) {
      this.setState((prevState) => {
        if (prevState.snapLines.length) {
          return {
            snapLines: [],
          };
        }
        return null;
      });
    }

    if (
      this.state.editingLinearElement &&
      !this.state.editingLinearElement.isDragging
    ) {
      const editingLinearElement = LinearElementEditor.handlePointerMove(
        event,
        scenePointerX,
        scenePointerY,
        this,
        this.scene.getNonDeletedElementsMap(),
      );

      if (
        editingLinearElement &&
        editingLinearElement !== this.state.editingLinearElement
      ) {
        // Since we are reading from previous state which is not possible with
        // automatic batching in React 18 hence using flush sync to synchronously
        // update the state. Check https://github.com/excalidraw/excalidraw/pull/5508 for more details.
        flushSync(() => {
          this.setState({
            editingLinearElement,
          });
        });
      }
      if (editingLinearElement?.lastUncommittedPoint != null) {
        this.maybeSuggestBindingAtCursor(scenePointer);
      } else {
        // causes stack overflow if not sync
        flushSync(() => {
          this.setState({ suggestedBindings: [] });
        });
      }
    }

    if (isBindingElementType(this.state.activeTool.type)) {
      // Hovering with a selected tool or creating new linear element via click
      // and point
      const { newElement } = this.state;
      if (isBindingElement(newElement, false)) {
        this.maybeSuggestBindingsForLinearElementAtCoords(
          newElement,
          [scenePointer],
          this.state.startBoundElement,
        );
      } else {
        this.maybeSuggestBindingAtCursor(scenePointer);
      }
    }

    if (this.state.multiElement) {
      const { multiElement } = this.state;
      const { x: rx, y: ry } = multiElement;

      const { points, lastCommittedPoint } = multiElement;
      const lastPoint = points[points.length - 1];

      setCursorForShape(this.interactiveCanvas, this.state);

      if (lastPoint === lastCommittedPoint) {
        // if we haven't yet created a temp point and we're beyond commit-zone
        // threshold, add a point
        if (
          pointDistance(
            pointFrom(scenePointerX - rx, scenePointerY - ry),
            lastPoint,
          ) >= LINE_CONFIRM_THRESHOLD
        ) {
          mutateElement(
            multiElement,
            {
              points: [
                ...points,
                pointFrom<LocalPoint>(scenePointerX - rx, scenePointerY - ry),
              ],
            },
            false,
          );
        } else {
          setCursor(this.interactiveCanvas, CURSOR_TYPE.POINTER);
          // in this branch, we're inside the commit zone, and no uncommitted
          // point exists. Thus do nothing (don't add/remove points).
        }
      } else if (
        points.length > 2 &&
        lastCommittedPoint &&
        pointDistance(
          pointFrom(scenePointerX - rx, scenePointerY - ry),
          lastCommittedPoint,
        ) < LINE_CONFIRM_THRESHOLD
      ) {
        setCursor(this.interactiveCanvas, CURSOR_TYPE.POINTER);
        mutateElement(
          multiElement,
          {
            points: points.slice(0, -1),
          },
          false,
        );
      } else {
        const [gridX, gridY] = getGridPoint(
          scenePointerX,
          scenePointerY,
          event[KEYS.CTRL_OR_CMD] || isElbowArrow(multiElement)
            ? null
            : this.getEffectiveGridSize(),
        );

        const [lastCommittedX, lastCommittedY] =
          multiElement?.lastCommittedPoint ?? [0, 0];

        let dxFromLastCommitted = gridX - rx - lastCommittedX;
        let dyFromLastCommitted = gridY - ry - lastCommittedY;

        if (shouldRotateWithDiscreteAngle(event)) {
          ({ width: dxFromLastCommitted, height: dyFromLastCommitted } =
            getLockedLinearCursorAlignSize(
              // actual coordinate of the last committed point
              lastCommittedX + rx,
              lastCommittedY + ry,
              // cursor-grid coordinate
              gridX,
              gridY,
            ));
        }

        if (isPathALoop(points, this.state.zoom.value)) {
          setCursor(this.interactiveCanvas, CURSOR_TYPE.POINTER);
        }
        if (isElbowArrow(multiElement)) {
          mutateElbowArrow(
            multiElement,
            this.scene.getNonDeletedElementsMap(),
            [
              ...points.slice(0, -1),
              pointFrom<LocalPoint>(
                lastCommittedX + dxFromLastCommitted,
                lastCommittedY + dyFromLastCommitted,
              ),
            ],
            undefined,
            undefined,
            {
              isDragging: true,
              informMutation: false,
            },
          );
        } else {
          // update last uncommitted point
          mutateElement(
            multiElement,
            {
              points: [
                ...points.slice(0, -1),
                pointFrom<LocalPoint>(
                  lastCommittedX + dxFromLastCommitted,
                  lastCommittedY + dyFromLastCommitted,
                ),
              ],
            },
            false,
          );
        }

        // in this path, we're mutating multiElement to reflect
        // how it will be after adding pointer position as the next point
        // trigger update here so that new element canvas renders again to reflect this
        this.triggerRender(false);
      }

      return;
    }

    const hasDeselectedButton = Boolean(event.buttons);
    if (
      hasDeselectedButton ||
      (this.state.activeTool.type !== "selection" &&
        this.state.activeTool.type !== "text" &&
        this.state.activeTool.type !== "eraser")
    ) {
      return;
    }

    const elements = this.scene.getNonDeletedElements();

    const selectedElements = this.scene.getSelectedElements(this.state);
    if (
      selectedElements.length === 1 &&
      !isOverScrollBar &&
      !this.state.editingLinearElement
    ) {
      // for linear elements, we'd like to prioritize point dragging over edge resizing
      // therefore, we update and check hovered point index first
      if (this.state.selectedLinearElement) {
        this.handleHoverSelectedLinearElement(
          this.state.selectedLinearElement,
          scenePointerX,
          scenePointerY,
        );
      }

      if (
        (!this.state.selectedLinearElement ||
          this.state.selectedLinearElement.hoverPointIndex === -1) &&
        !(selectedElements.length === 1 && isElbowArrow(selectedElements[0]))
      ) {
        const elementWithTransformHandleType =
          getElementWithTransformHandleType(
            elements,
            this.state,
            scenePointerX,
            scenePointerY,
            this.state.zoom,
            event.pointerType,
            this.scene.getNonDeletedElementsMap(),
            this.device,
          );
        if (
          elementWithTransformHandleType &&
          elementWithTransformHandleType.transformHandleType
        ) {
          setCursor(
            this.interactiveCanvas,
            getCursorForResizingElement(elementWithTransformHandleType),
          );
          return;
        }
      }
    } else if (selectedElements.length > 1 && !isOverScrollBar) {
      const transformHandleType = getTransformHandleTypeFromCoords(
        getCommonBounds(selectedElements),
        scenePointerX,
        scenePointerY,
        this.state.zoom,
        event.pointerType,
        this.device,
      );
      if (transformHandleType) {
        setCursor(
          this.interactiveCanvas,
          getCursorForResizingElement({
            transformHandleType,
          }),
        );
        return;
      }
    }

    const hitElement = this.getElementAtPosition(
      scenePointer.x,
      scenePointer.y,
    );

    this.hitLinkElement = this.getElementLinkAtPosition(
      scenePointer,
      hitElement,
    );
    if (isEraserActive(this.state)) {
      return;
    }
    if (
      this.hitLinkElement &&
      !this.state.selectedElementIds[this.hitLinkElement.id]
    ) {
      setCursor(this.interactiveCanvas, CURSOR_TYPE.POINTER);
      showHyperlinkTooltip(
        this.hitLinkElement,
        this.state,
        this.scene.getNonDeletedElementsMap(),
      );
    } else {
      hideHyperlinkToolip();
      if (
        hitElement &&
        (hitElement.link || isEmbeddableElement(hitElement)) &&
        this.state.selectedElementIds[hitElement.id] &&
        !this.state.contextMenu &&
        !this.state.showHyperlinkPopup
      ) {
        this.setState({ showHyperlinkPopup: "info" });
      } else if (this.state.activeTool.type === "text") {
        setCursor(
          this.interactiveCanvas,
          isTextElement(hitElement) ? CURSOR_TYPE.TEXT : CURSOR_TYPE.CROSSHAIR,
        );
      } else if (this.state.viewModeEnabled) {
        setCursor(this.interactiveCanvas, CURSOR_TYPE.GRAB);
      } else if (isOverScrollBar) {
        setCursor(this.interactiveCanvas, CURSOR_TYPE.AUTO);
      } else if (this.state.selectedLinearElement) {
        this.handleHoverSelectedLinearElement(
          this.state.selectedLinearElement,
          scenePointerX,
          scenePointerY,
        );
      } else if (
        // if using cmd/ctrl, we're not dragging
        !event[KEYS.CTRL_OR_CMD]
      ) {
        if (
          (hitElement ||
            this.isHittingCommonBoundingBoxOfSelectedElements(
              scenePointer,
              selectedElements,
            )) &&
          !hitElement?.locked
        ) {
          if (
            hitElement &&
            isIframeLikeElement(hitElement) &&
            this.isIframeLikeElementCenter(
              hitElement,
              event,
              scenePointerX,
              scenePointerY,
            )
          ) {
            setCursor(this.interactiveCanvas, CURSOR_TYPE.POINTER);
            this.setState({
              activeEmbeddable: { element: hitElement, state: "hover" },
            });
          } else {
            setCursor(this.interactiveCanvas, CURSOR_TYPE.MOVE);
            if (this.state.activeEmbeddable?.state === "hover") {
              this.setState({ activeEmbeddable: null });
            }
          }
        }
      } else {
        setCursor(this.interactiveCanvas, CURSOR_TYPE.AUTO);
      }
    }
  };

  private handleEraser = (
    event: PointerEvent,
    pointerDownState: PointerDownState,
    scenePointer: { x: number; y: number },
  ) => {
    this.eraserTrail.addPointToPath(scenePointer.x, scenePointer.y);

    let didChange = false;

    const processedGroups = new Set<ExcalidrawElement["id"]>();
    const nonDeletedElements = this.scene.getNonDeletedElements();

    const processElements = (elements: ExcalidrawElement[]) => {
      for (const element of elements) {
        if (element.locked) {
          return;
        }

        if (event.altKey) {
          if (this.elementsPendingErasure.delete(element.id)) {
            didChange = true;
          }
        } else if (!this.elementsPendingErasure.has(element.id)) {
          didChange = true;
          this.elementsPendingErasure.add(element.id);
        }

        // (un)erase groups atomically
        if (didChange && element.groupIds?.length) {
          const shallowestGroupId = element.groupIds.at(-1)!;
          if (!processedGroups.has(shallowestGroupId)) {
            processedGroups.add(shallowestGroupId);
            const elems = getElementsInGroup(
              nonDeletedElements,
              shallowestGroupId,
            );
            for (const elem of elems) {
              if (event.altKey) {
                this.elementsPendingErasure.delete(elem.id);
              } else {
                this.elementsPendingErasure.add(elem.id);
              }
            }
          }
        }
      }
    };

    const distance = pointDistance(
      pointFrom(pointerDownState.lastCoords.x, pointerDownState.lastCoords.y),
      pointFrom(scenePointer.x, scenePointer.y),
    );
    const threshold = this.getElementHitThreshold();
    const p = { ...pointerDownState.lastCoords };
    let samplingInterval = 0;
    while (samplingInterval <= distance) {
      const hitElements = this.getElementsAtPosition(p.x, p.y);
      processElements(hitElements);

      // Exit since we reached current point
      if (samplingInterval === distance) {
        break;
      }

      // Calculate next point in the line at a distance of sampling interval
      samplingInterval = Math.min(samplingInterval + threshold, distance);

      const distanceRatio = samplingInterval / distance;
      const nextX = (1 - distanceRatio) * p.x + distanceRatio * scenePointer.x;
      const nextY = (1 - distanceRatio) * p.y + distanceRatio * scenePointer.y;
      p.x = nextX;
      p.y = nextY;
    }

    pointerDownState.lastCoords.x = scenePointer.x;
    pointerDownState.lastCoords.y = scenePointer.y;

    if (didChange) {
      for (const element of this.scene.getNonDeletedElements()) {
        if (
          isBoundToContainer(element) &&
          (this.elementsPendingErasure.has(element.id) ||
            this.elementsPendingErasure.has(element.containerId))
        ) {
          if (event.altKey) {
            this.elementsPendingErasure.delete(element.id);
            this.elementsPendingErasure.delete(element.containerId);
          } else {
            this.elementsPendingErasure.add(element.id);
            this.elementsPendingErasure.add(element.containerId);
          }
        }
      }

      this.elementsPendingErasure = new Set(this.elementsPendingErasure);
      this.triggerRender();
    }
  };

  // set touch moving for mobile context menu
  private handleTouchMove = (event: React.TouchEvent<HTMLCanvasElement>) => {
    invalidateContextMenu = true;
  };

  handleHoverSelectedLinearElement(
    linearElementEditor: LinearElementEditor,
    scenePointerX: number,
    scenePointerY: number,
  ) {
    const elementsMap = this.scene.getNonDeletedElementsMap();

    const element = LinearElementEditor.getElement(
      linearElementEditor.elementId,
      elementsMap,
    );

    if (!element) {
      return;
    }
    if (this.state.selectedLinearElement) {
      let hoverPointIndex = -1;
      let segmentMidPointHoveredCoords = null;
      if (
        hitElementItself({
          x: scenePointerX,
          y: scenePointerY,
          element,
          shape: getElementShape(
            element,
            this.scene.getNonDeletedElementsMap(),
          ),
        })
      ) {
        hoverPointIndex = LinearElementEditor.getPointIndexUnderCursor(
          element,
          elementsMap,
          this.state.zoom,
          scenePointerX,
          scenePointerY,
        );
        segmentMidPointHoveredCoords =
          LinearElementEditor.getSegmentMidpointHitCoords(
            linearElementEditor,
            { x: scenePointerX, y: scenePointerY },
            this.state,
            this.scene.getNonDeletedElementsMap(),
          );

        if (hoverPointIndex >= 0 || segmentMidPointHoveredCoords) {
          setCursor(this.interactiveCanvas, CURSOR_TYPE.POINTER);
        } else if (this.hitElement(scenePointerX, scenePointerY, element)) {
          setCursor(this.interactiveCanvas, CURSOR_TYPE.MOVE);
        }
      } else if (this.hitElement(scenePointerX, scenePointerY, element)) {
        if (
          !isElbowArrow(element) ||
          !(element.startBinding || element.endBinding)
        ) {
          setCursor(this.interactiveCanvas, CURSOR_TYPE.MOVE);
        }
      }

      if (
        this.state.selectedLinearElement.hoverPointIndex !== hoverPointIndex
      ) {
        this.setState({
          selectedLinearElement: {
            ...this.state.selectedLinearElement,
            hoverPointIndex,
          },
        });
      }

      if (
        !LinearElementEditor.arePointsEqual(
          this.state.selectedLinearElement.segmentMidPointHoveredCoords,
          segmentMidPointHoveredCoords,
        )
      ) {
        this.setState({
          selectedLinearElement: {
            ...this.state.selectedLinearElement,
            segmentMidPointHoveredCoords,
          },
        });
      }
    } else {
      setCursor(this.interactiveCanvas, CURSOR_TYPE.AUTO);
    }
  }

  private handleCanvasPointerDown = (
    event: React.PointerEvent<HTMLElement>,
  ) => {
    this.maybeCleanupAfterMissingPointerUp(event.nativeEvent);
    this.maybeUnfollowRemoteUser();

    if (this.state.searchMatches) {
      this.setState((state) => ({
        searchMatches: state.searchMatches.map((searchMatch) => ({
          ...searchMatch,
          focus: false,
        })),
      }));
      jotaiStore.set(searchItemInFocusAtom, null);
    }

    // since contextMenu options are potentially evaluated on each render,
    // and an contextMenu action may depend on selection state, we must
    // close the contextMenu before we update the selection on pointerDown
    // (e.g. resetting selection)
    if (this.state.contextMenu) {
      this.setState({ contextMenu: null });
    }

    if (this.state.snapLines) {
      this.setAppState({ snapLines: [] });
    }

    this.updateGestureOnPointerDown(event);

    // if dragging element is freedraw and another pointerdown event occurs
    // a second finger is on the screen
    // discard the freedraw element if it is very short because it is likely
    // just a spike, otherwise finalize the freedraw element when the second
    // finger is lifted
    if (
      event.pointerType === "touch" &&
      this.state.newElement &&
      this.state.newElement.type === "freedraw"
    ) {
      const element = this.state.newElement as ExcalidrawFreeDrawElement;
      this.updateScene({
        ...(element.points.length < 10
          ? {
              elements: this.scene
                .getElementsIncludingDeleted()
                .filter((el) => el.id !== element.id),
            }
          : {}),
        appState: {
          newElement: null,
          editingTextElement: null,
          startBoundElement: null,
          suggestedBindings: [],
          selectedElementIds: makeNextSelectedElementIds(
            Object.keys(this.state.selectedElementIds)
              .filter((key) => key !== element.id)
              .reduce((obj: { [id: string]: true }, key) => {
                obj[key] = this.state.selectedElementIds[key];
                return obj;
              }, {}),
            this.state,
          ),
        },
        storeAction: StoreAction.UPDATE,
      });
      return;
    }

    // remove any active selection when we start to interact with canvas
    // (mainly, we care about removing selection outside the component which
    //  would prevent our copy handling otherwise)
    const selection = document.getSelection();
    if (selection?.anchorNode) {
      selection.removeAllRanges();
    }
    this.maybeOpenContextMenuAfterPointerDownOnTouchDevices(event);

    //fires only once, if pen is detected, penMode is enabled
    //the user can disable this by toggling the penMode button
    if (!this.state.penDetected && event.pointerType === "pen") {
      this.setState((prevState) => {
        return {
          penMode: true,
          penDetected: true,
        };
      });
    }

    if (
      !this.device.isTouchScreen &&
      ["pen", "touch"].includes(event.pointerType)
    ) {
      this.device = updateObject(this.device, { isTouchScreen: true });
    }

    if (isPanning) {
      return;
    }

    this.lastPointerDownEvent = event;

    // we must exit before we set `cursorButton` state and `savePointer`
    // else it will send pointer state & laser pointer events in collab when
    // panning
    if (this.handleCanvasPanUsingWheelOrSpaceDrag(event)) {
      return;
    }

    this.setState({
      lastPointerDownWith: event.pointerType,
      cursorButton: "down",
    });
    this.savePointer(event.clientX, event.clientY, "down");

    if (
      event.button === POINTER_BUTTON.ERASER &&
      this.state.activeTool.type !== TOOL_TYPE.eraser
    ) {
      this.setState(
        {
          activeTool: updateActiveTool(this.state, {
            type: TOOL_TYPE.eraser,
            lastActiveToolBeforeEraser: this.state.activeTool,
          }),
        },
        () => {
          this.handleCanvasPointerDown(event);
          const onPointerUp = () => {
            unsubPointerUp();
            unsubCleanup?.();
            if (isEraserActive(this.state)) {
              this.setState({
                activeTool: updateActiveTool(this.state, {
                  ...(this.state.activeTool.lastActiveTool || {
                    type: TOOL_TYPE.selection,
                  }),
                  lastActiveToolBeforeEraser: null,
                }),
              });
            }
          };

          const unsubPointerUp = addEventListener(
            window,
            EVENT.POINTER_UP,
            onPointerUp,
            {
              once: true,
            },
          );
          let unsubCleanup: UnsubscribeCallback | undefined;
          // subscribe inside rAF lest it'd be triggered on the same pointerdown
          // if we start erasing while coming from blurred document since
          // we cleanup pointer events on focus
          requestAnimationFrame(() => {
            unsubCleanup =
              this.missingPointerEventCleanupEmitter.once(onPointerUp);
          });
        },
      );
      return;
    }

    // only handle left mouse button or touch
    if (
      event.button !== POINTER_BUTTON.MAIN &&
      event.button !== POINTER_BUTTON.TOUCH &&
      event.button !== POINTER_BUTTON.ERASER
    ) {
      return;
    }

    // don't select while panning
    if (gesture.pointers.size > 1) {
      return;
    }

    // State for the duration of a pointer interaction, which starts with a
    // pointerDown event, ends with a pointerUp event (or another pointerDown)
    const pointerDownState = this.initialPointerDownState(event);

    this.setState({
      selectedElementsAreBeingDragged: false,
    });

    if (this.handleDraggingScrollBar(event, pointerDownState)) {
      return;
    }

    this.clearSelectionIfNotUsingSelection();
    this.updateBindingEnabledOnPointerMove(event);

    if (this.handleSelectionOnPointerDown(event, pointerDownState)) {
      return;
    }

    const allowOnPointerDown =
      !this.state.penMode ||
      event.pointerType !== "touch" ||
      this.state.activeTool.type === "selection" ||
      this.state.activeTool.type === "text" ||
      this.state.activeTool.type === "image";

    if (!allowOnPointerDown) {
      return;
    }

    if (this.state.activeTool.type === "text") {
      this.handleTextOnPointerDown(event, pointerDownState);
    } else if (
      this.state.activeTool.type === "arrow" ||
      this.state.activeTool.type === "line"
    ) {
      this.handleLinearElementOnPointerDown(
        event,
        this.state.activeTool.type,
        pointerDownState,
      );
    } else if (this.state.activeTool.type === "image") {
      // reset image preview on pointerdown
      setCursor(this.interactiveCanvas, CURSOR_TYPE.CROSSHAIR);

      // retrieve the latest element as the state may be stale
      const pendingImageElement =
        this.state.pendingImageElementId &&
        this.scene.getElement(this.state.pendingImageElementId);

      if (!pendingImageElement) {
        return;
      }

      this.setState({
        newElement: pendingImageElement as ExcalidrawNonSelectionElement,
        pendingImageElementId: null,
        multiElement: null,
      });

      const { x, y } = viewportCoordsToSceneCoords(event, this.state);

      const frame = this.getTopLayerFrameAtSceneCoords({ x, y });

      mutateElement(pendingImageElement, {
        x,
        y,
        frameId: frame ? frame.id : null,
      });
    } else if (this.state.activeTool.type === "freedraw") {
      this.handleFreeDrawElementOnPointerDown(
        event,
        this.state.activeTool.type,
        pointerDownState,
      );
    } else if (this.state.activeTool.type === "custom") {
      setCursorForShape(this.interactiveCanvas, this.state);
    } else if (
      this.state.activeTool.type === TOOL_TYPE.frame ||
      this.state.activeTool.type === TOOL_TYPE.magicframe
    ) {
      this.createFrameElementOnPointerDown(
        pointerDownState,
        this.state.activeTool.type,
      );
    } else if (this.state.activeTool.type === "laser") {
      this.laserTrails.startPath(
        pointerDownState.lastCoords.x,
        pointerDownState.lastCoords.y,
      );
    } else if (
      this.state.activeTool.type !== "eraser" &&
      this.state.activeTool.type !== "hand"
    ) {
      this.createGenericElementOnPointerDown(
        this.state.activeTool.type,
        pointerDownState,
      );
    }

    this.props?.onPointerDown?.(this.state.activeTool, pointerDownState);
    this.onPointerDownEmitter.trigger(
      this.state.activeTool,
      pointerDownState,
      event,
    );

    if (this.state.activeTool.type === "eraser") {
      this.eraserTrail.startPath(
        pointerDownState.lastCoords.x,
        pointerDownState.lastCoords.y,
      );
    }

    const onPointerMove =
      this.onPointerMoveFromPointerDownHandler(pointerDownState);

    const onPointerUp =
      this.onPointerUpFromPointerDownHandler(pointerDownState);

    const onKeyDown = this.onKeyDownFromPointerDownHandler(pointerDownState);
    const onKeyUp = this.onKeyUpFromPointerDownHandler(pointerDownState);

    this.missingPointerEventCleanupEmitter.once((_event) =>
      onPointerUp(_event || event.nativeEvent),
    );

    if (!this.state.viewModeEnabled || this.state.activeTool.type === "laser") {
      window.addEventListener(EVENT.POINTER_MOVE, onPointerMove);
      window.addEventListener(EVENT.POINTER_UP, onPointerUp);
      window.addEventListener(EVENT.KEYDOWN, onKeyDown);
      window.addEventListener(EVENT.KEYUP, onKeyUp);
      pointerDownState.eventListeners.onMove = onPointerMove;
      pointerDownState.eventListeners.onUp = onPointerUp;
      pointerDownState.eventListeners.onKeyUp = onKeyUp;
      pointerDownState.eventListeners.onKeyDown = onKeyDown;
    }
  };

  private handleCanvasPointerUp = (
    event: React.PointerEvent<HTMLCanvasElement>,
  ) => {
    this.removePointer(event);
    this.lastPointerUpEvent = event;

    const scenePointer = viewportCoordsToSceneCoords(
      { clientX: event.clientX, clientY: event.clientY },
      this.state,
    );
    const clicklength =
      event.timeStamp - (this.lastPointerDownEvent?.timeStamp ?? 0);

    if (this.device.editor.isMobile && clicklength < 300) {
      const hitElement = this.getElementAtPosition(
        scenePointer.x,
        scenePointer.y,
      );
      if (
        isIframeLikeElement(hitElement) &&
        this.isIframeLikeElementCenter(
          hitElement,
          event,
          scenePointer.x,
          scenePointer.y,
        )
      ) {
        this.handleEmbeddableCenterClick(hitElement);
        return;
      }
    }

    if (this.device.isTouchScreen) {
      const hitElement = this.getElementAtPosition(
        scenePointer.x,
        scenePointer.y,
      );
      this.hitLinkElement = this.getElementLinkAtPosition(
        scenePointer,
        hitElement,
      );
    }

    if (
      this.hitLinkElement &&
      !this.state.selectedElementIds[this.hitLinkElement.id]
    ) {
      if (
        clicklength < 300 &&
        isIframeLikeElement(this.hitLinkElement) &&
        !isPointHittingLinkIcon(
          this.hitLinkElement,
          this.scene.getNonDeletedElementsMap(),
          this.state,
          pointFrom(scenePointer.x, scenePointer.y),
        )
      ) {
        this.handleEmbeddableCenterClick(this.hitLinkElement);
      } else {
        this.redirectToLink(event, this.device.isTouchScreen);
      }
    } else if (this.state.viewModeEnabled) {
      this.setState({
        activeEmbeddable: null,
        selectedElementIds: {},
      });
    }
  };

  private maybeOpenContextMenuAfterPointerDownOnTouchDevices = (
    event: React.PointerEvent<HTMLElement>,
  ): void => {
    // deal with opening context menu on touch devices
    if (event.pointerType === "touch") {
      invalidateContextMenu = false;

      if (touchTimeout) {
        // If there's already a touchTimeout, this means that there's another
        // touch down and we are doing another touch, so we shouldn't open the
        // context menu.
        invalidateContextMenu = true;
      } else {
        // open the context menu with the first touch's clientX and clientY
        // if the touch is not moving
        touchTimeout = window.setTimeout(() => {
          touchTimeout = 0;
          if (!invalidateContextMenu) {
            this.handleCanvasContextMenu(event);
          }
        }, TOUCH_CTX_MENU_TIMEOUT);
      }
    }
  };

  private resetContextMenuTimer = () => {
    clearTimeout(touchTimeout);
    touchTimeout = 0;
    invalidateContextMenu = false;
  };

  /**
   * pointerup may not fire in certian cases (user tabs away...), so in order
   * to properly cleanup pointerdown state, we need to fire any hanging
   * pointerup handlers manually
   */
  private maybeCleanupAfterMissingPointerUp = (event: PointerEvent | null) => {
    lastPointerUp?.();
    this.missingPointerEventCleanupEmitter.trigger(event).clear();
  };

  // Returns whether the event is a panning
  public handleCanvasPanUsingWheelOrSpaceDrag = (
    event: React.PointerEvent<HTMLElement> | MouseEvent,
  ): boolean => {
    if (
      !(
        gesture.pointers.size <= 1 &&
        (event.button === POINTER_BUTTON.WHEEL ||
          (event.button === POINTER_BUTTON.MAIN && isHoldingSpace) ||
          isHandToolActive(this.state) ||
          this.state.viewModeEnabled)
      )
    ) {
      return false;
    }
    isPanning = true;

    // due to event.preventDefault below, container wouldn't get focus
    // automatically
    this.focusContainer();

    // preventing defualt while text editing messes with cursor/focus
    if (!this.state.editingTextElement) {
      // necessary to prevent browser from scrolling the page if excalidraw
      // not full-page #4489
      //
      // as such, the above is broken when panning canvas while in wysiwyg
      event.preventDefault();
    }

    let nextPastePrevented = false;
    const isLinux =
      typeof window === undefined
        ? false
        : /Linux/.test(window.navigator.platform);

    setCursor(this.interactiveCanvas, CURSOR_TYPE.GRABBING);
    let { clientX: lastX, clientY: lastY } = event;
    const onPointerMove = withBatchedUpdatesThrottled((event: PointerEvent) => {
      const deltaX = lastX - event.clientX;
      const deltaY = lastY - event.clientY;
      lastX = event.clientX;
      lastY = event.clientY;

      /*
       * Prevent paste event if we move while middle clicking on Linux.
       * See issue #1383.
       */
      if (
        isLinux &&
        !nextPastePrevented &&
        (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1)
      ) {
        nextPastePrevented = true;

        /* Prevent the next paste event */
        const preventNextPaste = (event: ClipboardEvent) => {
          document.body.removeEventListener(EVENT.PASTE, preventNextPaste);
          event.stopPropagation();
        };

        /*
         * Reenable next paste in case of disabled middle click paste for
         * any reason:
         * - right click paste
         * - empty clipboard
         */
        const enableNextPaste = () => {
          setTimeout(() => {
            document.body.removeEventListener(EVENT.PASTE, preventNextPaste);
            window.removeEventListener(EVENT.POINTER_UP, enableNextPaste);
          }, 100);
        };

        document.body.addEventListener(EVENT.PASTE, preventNextPaste);
        window.addEventListener(EVENT.POINTER_UP, enableNextPaste);
      }

      this.translateCanvas({
        scrollX: this.state.scrollX - deltaX / this.state.zoom.value,
        scrollY: this.state.scrollY - deltaY / this.state.zoom.value,
      });
    });
    const teardown = withBatchedUpdates(
      (lastPointerUp = () => {
        lastPointerUp = null;
        isPanning = false;
        if (!isHoldingSpace) {
          if (this.state.viewModeEnabled) {
            setCursor(this.interactiveCanvas, CURSOR_TYPE.GRAB);
          } else {
            setCursorForShape(this.interactiveCanvas, this.state);
          }
        }
        this.setState({
          cursorButton: "up",
        });
        this.savePointer(event.clientX, event.clientY, "up");
        window.removeEventListener(EVENT.POINTER_MOVE, onPointerMove);
        window.removeEventListener(EVENT.POINTER_UP, teardown);
        window.removeEventListener(EVENT.BLUR, teardown);
        onPointerMove.flush();
      }),
    );
    window.addEventListener(EVENT.BLUR, teardown);
    window.addEventListener(EVENT.POINTER_MOVE, onPointerMove, {
      passive: true,
    });
    window.addEventListener(EVENT.POINTER_UP, teardown);
    return true;
  };

  private updateGestureOnPointerDown(
    event: React.PointerEvent<HTMLElement>,
  ): void {
    gesture.pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (gesture.pointers.size === 2) {
      gesture.lastCenter = getCenter(gesture.pointers);
      gesture.initialScale = this.state.zoom.value;
      gesture.initialDistance = getDistance(
        Array.from(gesture.pointers.values()),
      );
    }
  }

  private initialPointerDownState(
    event: React.PointerEvent<HTMLElement>,
  ): PointerDownState {
    const origin = viewportCoordsToSceneCoords(event, this.state);
    const selectedElements = this.scene.getSelectedElements(this.state);
    const [minX, minY, maxX, maxY] = getCommonBounds(selectedElements);
    const isElbowArrowOnly = selectedElements.findIndex(isElbowArrow) === 0;

    return {
      origin,
      withCmdOrCtrl: event[KEYS.CTRL_OR_CMD],
      originInGrid: tupleToCoors(
        getGridPoint(
          origin.x,
          origin.y,
          event[KEYS.CTRL_OR_CMD] || isElbowArrowOnly
            ? null
            : this.getEffectiveGridSize(),
        ),
      ),
      scrollbars: isOverScrollBars(
        currentScrollBars,
        event.clientX - this.state.offsetLeft,
        event.clientY - this.state.offsetTop,
      ),
      // we need to duplicate because we'll be updating this state
      lastCoords: { ...origin },
      originalElements: this.scene
        .getNonDeletedElements()
        .reduce((acc, element) => {
          acc.set(element.id, deepCopyElement(element));
          return acc;
        }, new Map() as PointerDownState["originalElements"]),
      resize: {
        handleType: false,
        isResizing: false,
        offset: { x: 0, y: 0 },
        arrowDirection: "origin",
        center: { x: (maxX + minX) / 2, y: (maxY + minY) / 2 },
      },
      hit: {
        element: null,
        allHitElements: [],
        wasAddedToSelection: false,
        hasBeenDuplicated: false,
        hasHitCommonBoundingBoxOfSelectedElements:
          this.isHittingCommonBoundingBoxOfSelectedElements(
            origin,
            selectedElements,
          ),
      },
      drag: {
        hasOccurred: false,
        offset: null,
      },
      eventListeners: {
        onMove: null,
        onUp: null,
        onKeyUp: null,
        onKeyDown: null,
      },
      boxSelection: {
        hasOccurred: false,
      },
    };
  }

  // Returns whether the event is a dragging a scrollbar
  private handleDraggingScrollBar(
    event: React.PointerEvent<HTMLElement>,
    pointerDownState: PointerDownState,
  ): boolean {
    if (
      !(pointerDownState.scrollbars.isOverEither && !this.state.multiElement)
    ) {
      return false;
    }
    isDraggingScrollBar = true;
    pointerDownState.lastCoords.x = event.clientX;
    pointerDownState.lastCoords.y = event.clientY;
    const onPointerMove = withBatchedUpdatesThrottled((event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      this.handlePointerMoveOverScrollbars(event, pointerDownState);
    });
    const onPointerUp = withBatchedUpdates(() => {
      lastPointerUp = null;
      isDraggingScrollBar = false;
      setCursorForShape(this.interactiveCanvas, this.state);
      this.setState({
        cursorButton: "up",
      });
      this.savePointer(event.clientX, event.clientY, "up");
      window.removeEventListener(EVENT.POINTER_MOVE, onPointerMove);
      window.removeEventListener(EVENT.POINTER_UP, onPointerUp);
      onPointerMove.flush();
    });

    lastPointerUp = onPointerUp;

    window.addEventListener(EVENT.POINTER_MOVE, onPointerMove);
    window.addEventListener(EVENT.POINTER_UP, onPointerUp);
    return true;
  }

  private clearSelectionIfNotUsingSelection = (): void => {
    if (this.state.activeTool.type !== "selection") {
      this.setState({
        selectedElementIds: makeNextSelectedElementIds({}, this.state),
        selectedGroupIds: {},
        editingGroupId: null,
        activeEmbeddable: null,
      });
    }
  };

  /**
   * @returns whether the pointer event has been completely handled
   */
  private handleSelectionOnPointerDown = (
    event: React.PointerEvent<HTMLElement>,
    pointerDownState: PointerDownState,
  ): boolean => {
    if (this.state.activeTool.type === "selection") {
      const elements = this.scene.getNonDeletedElements();
      const elementsMap = this.scene.getNonDeletedElementsMap();
      const selectedElements = this.scene.getSelectedElements(this.state);

      if (
        selectedElements.length === 1 &&
        !this.state.editingLinearElement &&
        !(
          this.state.selectedLinearElement &&
          this.state.selectedLinearElement.hoverPointIndex !== -1
        )
      ) {
        const elementWithTransformHandleType =
          getElementWithTransformHandleType(
            elements,
            this.state,
            pointerDownState.origin.x,
            pointerDownState.origin.y,
            this.state.zoom,
            event.pointerType,
            this.scene.getNonDeletedElementsMap(),
            this.device,
          );
        if (elementWithTransformHandleType != null) {
          if (
            elementWithTransformHandleType.transformHandleType === "rotation"
          ) {
            this.setState({
              resizingElement: elementWithTransformHandleType.element,
            });
            pointerDownState.resize.handleType =
              elementWithTransformHandleType.transformHandleType;
          } else if (this.state.croppingElementId) {
            pointerDownState.resize.handleType =
              elementWithTransformHandleType.transformHandleType;
          } else {
            this.setState({
              resizingElement: elementWithTransformHandleType.element,
            });
            pointerDownState.resize.handleType =
              elementWithTransformHandleType.transformHandleType;
          }
        }
      } else if (selectedElements.length > 1) {
        pointerDownState.resize.handleType = getTransformHandleTypeFromCoords(
          getCommonBounds(selectedElements),
          pointerDownState.origin.x,
          pointerDownState.origin.y,
          this.state.zoom,
          event.pointerType,
          this.device,
        );
      }
      if (pointerDownState.resize.handleType) {
        pointerDownState.resize.isResizing = true;
        pointerDownState.resize.offset = tupleToCoors(
          getResizeOffsetXY(
            pointerDownState.resize.handleType,
            selectedElements,
            elementsMap,
            pointerDownState.origin.x,
            pointerDownState.origin.y,
          ),
        );
        if (
          selectedElements.length === 1 &&
          isLinearElement(selectedElements[0]) &&
          selectedElements[0].points.length === 2
        ) {
          pointerDownState.resize.arrowDirection = getResizeArrowDirection(
            pointerDownState.resize.handleType,
            selectedElements[0],
          );
        }
      } else {
        if (this.state.selectedLinearElement) {
          const linearElementEditor =
            this.state.editingLinearElement || this.state.selectedLinearElement;
          const ret = LinearElementEditor.handlePointerDown(
            event,
            this,
            this.store,
            pointerDownState.origin,
            linearElementEditor,
            this.scene,
          );
          if (ret.hitElement) {
            pointerDownState.hit.element = ret.hitElement;
          }
          if (ret.linearElementEditor) {
            this.setState({ selectedLinearElement: ret.linearElementEditor });

            if (this.state.editingLinearElement) {
              this.setState({ editingLinearElement: ret.linearElementEditor });
            }
          }
          if (ret.didAddPoint) {
            return true;
          }
        }
        // hitElement may already be set above, so check first
        pointerDownState.hit.element =
          pointerDownState.hit.element ??
          this.getElementAtPosition(
            pointerDownState.origin.x,
            pointerDownState.origin.y,
          );

        if (
          this.state.croppingElementId &&
          pointerDownState.hit.element?.id !== this.state.croppingElementId
        ) {
          this.finishImageCropping();
        }

        if (pointerDownState.hit.element) {
          // Early return if pointer is hitting link icon
          const hitLinkElement = this.getElementLinkAtPosition(
            {
              x: pointerDownState.origin.x,
              y: pointerDownState.origin.y,
            },
            pointerDownState.hit.element,
          );
          if (hitLinkElement) {
            return false;
          }
        }

        // For overlapped elements one position may hit
        // multiple elements
        pointerDownState.hit.allHitElements = this.getElementsAtPosition(
          pointerDownState.origin.x,
          pointerDownState.origin.y,
        );

        const hitElement = pointerDownState.hit.element;
        const someHitElementIsSelected =
          pointerDownState.hit.allHitElements.some((element) =>
            this.isASelectedElement(element),
          );
        if (
          (hitElement === null || !someHitElementIsSelected) &&
          !event.shiftKey &&
          !pointerDownState.hit.hasHitCommonBoundingBoxOfSelectedElements
        ) {
          this.clearSelection(hitElement);
        }

        if (this.state.editingLinearElement) {
          this.setState({
            selectedElementIds: makeNextSelectedElementIds(
              {
                [this.state.editingLinearElement.elementId]: true,
              },
              this.state,
            ),
          });
          // If we click on something
        } else if (hitElement != null) {
          // on CMD/CTRL, drill down to hit element regardless of groups etc.
          if (event[KEYS.CTRL_OR_CMD]) {
            if (!this.state.selectedElementIds[hitElement.id]) {
              pointerDownState.hit.wasAddedToSelection = true;
            }
            this.setState((prevState) => ({
              ...editGroupForSelectedElement(prevState, hitElement),
              previousSelectedElementIds: this.state.selectedElementIds,
            }));
            // mark as not completely handled so as to allow dragging etc.
            return false;
          }

          // deselect if item is selected
          // if shift is not clicked, this will always return true
          // otherwise, it will trigger selection based on current
          // state of the box
          if (!this.state.selectedElementIds[hitElement.id]) {
            // if we are currently editing a group, exiting editing mode and deselect the group.
            if (
              this.state.editingGroupId &&
              !isElementInGroup(hitElement, this.state.editingGroupId)
            ) {
              this.setState({
                selectedElementIds: makeNextSelectedElementIds({}, this.state),
                selectedGroupIds: {},
                editingGroupId: null,
                activeEmbeddable: null,
              });
            }

            // Add hit element to selection. At this point if we're not holding
            // SHIFT the previously selected element(s) were deselected above
            // (make sure you use setState updater to use latest state)
            // With shift-selection, we want to make sure that frames and their containing
            // elements are not selected at the same time.
            if (
              !someHitElementIsSelected &&
              !pointerDownState.hit.hasHitCommonBoundingBoxOfSelectedElements
            ) {
              this.setState((prevState) => {
                const nextSelectedElementIds: { [id: string]: true } = {
                  ...prevState.selectedElementIds,
                  [hitElement.id]: true,
                };

                const previouslySelectedElements: ExcalidrawElement[] = [];

                Object.keys(prevState.selectedElementIds).forEach((id) => {
                  const element = this.scene.getElement(id);
                  element && previouslySelectedElements.push(element);
                });

                // if hitElement is frame-like, deselect all of its elements
                // if they are selected
                if (isFrameLikeElement(hitElement)) {
                  getFrameChildren(
                    previouslySelectedElements,
                    hitElement.id,
                  ).forEach((element) => {
                    delete nextSelectedElementIds[element.id];
                  });
                } else if (hitElement.frameId) {
                  // if hitElement is in a frame and its frame has been selected
                  // disable selection for the given element
                  if (nextSelectedElementIds[hitElement.frameId]) {
                    delete nextSelectedElementIds[hitElement.id];
                  }
                } else {
                  // hitElement is neither a frame nor an element in a frame
                  // but since hitElement could be in a group with some frames
                  // this means selecting hitElement will have the frames selected as well
                  // because we want to keep the invariant:
                  // - frames and their elements are not selected at the same time
                  // we deselect elements in those frames that were previously selected

                  const groupIds = hitElement.groupIds;
                  const framesInGroups = new Set(
                    groupIds
                      .flatMap((gid) =>
                        getElementsInGroup(
                          this.scene.getNonDeletedElements(),
                          gid,
                        ),
                      )
                      .filter((element) => isFrameLikeElement(element))
                      .map((frame) => frame.id),
                  );

                  if (framesInGroups.size > 0) {
                    previouslySelectedElements.forEach((element) => {
                      if (
                        element.frameId &&
                        framesInGroups.has(element.frameId)
                      ) {
                        // deselect element and groups containing the element
                        delete nextSelectedElementIds[element.id];
                        element.groupIds
                          .flatMap((gid) =>
                            getElementsInGroup(
                              this.scene.getNonDeletedElements(),
                              gid,
                            ),
                          )
                          .forEach((element) => {
                            delete nextSelectedElementIds[element.id];
                          });
                      }
                    });
                  }
                }

                return {
                  ...selectGroupsForSelectedElements(
                    {
                      editingGroupId: prevState.editingGroupId,
                      selectedElementIds: nextSelectedElementIds,
                    },
                    this.scene.getNonDeletedElements(),
                    prevState,
                    this,
                  ),
                  showHyperlinkPopup:
                    hitElement.link || isEmbeddableElement(hitElement)
                      ? "info"
                      : false,
                };
              });
              pointerDownState.hit.wasAddedToSelection = true;
            }
          }
        }

        this.setState({
          previousSelectedElementIds: this.state.selectedElementIds,
        });
      }
    }
    return false;
  };

  private isASelectedElement(hitElement: ExcalidrawElement | null): boolean {
    return hitElement != null && this.state.selectedElementIds[hitElement.id];
  }

  private isHittingCommonBoundingBoxOfSelectedElements(
    point: Readonly<{ x: number; y: number }>,
    selectedElements: readonly ExcalidrawElement[],
  ): boolean {
    if (selectedElements.length < 2) {
      return false;
    }

    // How many pixels off the shape boundary we still consider a hit
    const threshold = this.getElementHitThreshold();
    const [x1, y1, x2, y2] = getCommonBounds(selectedElements);
    return (
      point.x > x1 - threshold &&
      point.x < x2 + threshold &&
      point.y > y1 - threshold &&
      point.y < y2 + threshold
    );
  }

  private handleTextOnPointerDown = (
    event: React.PointerEvent<HTMLElement>,
    pointerDownState: PointerDownState,
  ): void => {
    // if we're currently still editing text, clicking outside
    // should only finalize it, not create another (irrespective
    // of state.activeTool.locked)
    if (this.state.editingTextElement) {
      return;
    }
    let sceneX = pointerDownState.origin.x;
    let sceneY = pointerDownState.origin.y;

    const element = this.getElementAtPosition(sceneX, sceneY, {
      includeBoundTextElement: true,
    });

    // FIXME
    let container = this.getTextBindableContainerAtPosition(sceneX, sceneY);

    if (hasBoundTextElement(element)) {
      container = element as ExcalidrawTextContainer;
      sceneX = element.x + element.width / 2;
      sceneY = element.y + element.height / 2;
    }
    this.startTextEditing({
      sceneX,
      sceneY,
      insertAtParentCenter: !event.altKey,
      container,
      autoEdit: false,
    });

    resetCursor(this.interactiveCanvas);
    if (!this.state.activeTool.locked) {
      this.setState({
        activeTool: updateActiveTool(this.state, { type: "selection" }),
      });
    }
  };

  private handleFreeDrawElementOnPointerDown = (
    event: React.PointerEvent<HTMLElement>,
    elementType: ExcalidrawFreeDrawElement["type"],
    pointerDownState: PointerDownState,
  ) => {
    // Begin a mark capture. This does not have to update state yet.
    const [gridX, gridY] = getGridPoint(
      pointerDownState.origin.x,
      pointerDownState.origin.y,
      null,
    );

    const topLayerFrame = this.getTopLayerFrameAtSceneCoords({
      x: gridX,
      y: gridY,
    });

    const simulatePressure = event.pressure === 0.5;

    const element = newFreeDrawElement({
      type: elementType,
      x: gridX,
      y: gridY,
      strokeColor: this.state.currentItemStrokeColor,
      backgroundColor: this.state.currentItemBackgroundColor,
      fillStyle: this.state.currentItemFillStyle,
      strokeWidth: this.state.currentItemStrokeWidth,
      strokeStyle: this.state.currentItemStrokeStyle,
      roughness: this.state.currentItemRoughness,
      opacity: this.state.currentItemOpacity,
      roundness: null,
      simulatePressure,
      locked: false,
      frameId: topLayerFrame ? topLayerFrame.id : null,
      points: [pointFrom<LocalPoint>(0, 0)],
      pressures: simulatePressure ? [] : [event.pressure],
    });

    this.scene.insertElement(element);

    this.setState((prevState) => {
      const nextSelectedElementIds = {
        ...prevState.selectedElementIds,
      };
      delete nextSelectedElementIds[element.id];
      return {
        selectedElementIds: makeNextSelectedElementIds(
          nextSelectedElementIds,
          prevState,
        ),
      };
    });

    const boundElement = getHoveredElementForBinding(
      pointerDownState.origin,
      this.scene.getNonDeletedElements(),
      this.scene.getNonDeletedElementsMap(),
    );

    this.setState({
      newElement: element,
      startBoundElement: boundElement,
      suggestedBindings: [],
    });
  };

  public insertIframeElement = ({
    sceneX,
    sceneY,
    width,
    height,
  }: {
    sceneX: number;
    sceneY: number;
    width: number;
    height: number;
  }) => {
    const [gridX, gridY] = getGridPoint(
      sceneX,
      sceneY,
      this.lastPointerDownEvent?.[KEYS.CTRL_OR_CMD]
        ? null
        : this.getEffectiveGridSize(),
    );

    const element = newIframeElement({
      type: "iframe",
      x: gridX,
      y: gridY,
      strokeColor: "transparent",
      backgroundColor: "transparent",
      fillStyle: this.state.currentItemFillStyle,
      strokeWidth: this.state.currentItemStrokeWidth,
      strokeStyle: this.state.currentItemStrokeStyle,
      roughness: this.state.currentItemRoughness,
      roundness: this.getCurrentItemRoundness("iframe"),
      opacity: this.state.currentItemOpacity,
      locked: false,
      width,
      height,
    });

    this.scene.insertElement(element);

    return element;
  };

  //create rectangle element with youtube top left on nearest grid point width / hight 640/360
  public insertEmbeddableElement = ({
    sceneX,
    sceneY,
    link,
  }: {
    sceneX: number;
    sceneY: number;
    link: string;
  }) => {
    const [gridX, gridY] = getGridPoint(
      sceneX,
      sceneY,
      this.lastPointerDownEvent?.[KEYS.CTRL_OR_CMD]
        ? null
        : this.getEffectiveGridSize(),
    );

    const embedLink = getEmbedLink(link);

    if (!embedLink) {
      return;
    }

    if (embedLink.error instanceof URIError) {
      this.setToast({
        message: t("toast.unrecognizedLinkFormat"),
        closable: true,
      });
    }

    const element = newEmbeddableElement({
      type: "embeddable",
      x: gridX,
      y: gridY,
      strokeColor: "transparent",
      backgroundColor: "transparent",
      fillStyle: this.state.currentItemFillStyle,
      strokeWidth: this.state.currentItemStrokeWidth,
      strokeStyle: this.state.currentItemStrokeStyle,
      roughness: this.state.currentItemRoughness,
      roundness: this.getCurrentItemRoundness("embeddable"),
      opacity: this.state.currentItemOpacity,
      locked: false,
      width: embedLink.intrinsicSize.w,
      height: embedLink.intrinsicSize.h,
      link,
    });

    this.scene.insertElement(element);

    return element;
  };

  private createImageElement = ({
    sceneX,
    sceneY,
    addToFrameUnderCursor = true,
  }: {
    sceneX: number;
    sceneY: number;
    addToFrameUnderCursor?: boolean;
  }) => {
    const [gridX, gridY] = getGridPoint(
      sceneX,
      sceneY,
      this.lastPointerDownEvent?.[KEYS.CTRL_OR_CMD]
        ? null
        : this.getEffectiveGridSize(),
    );

    const topLayerFrame = addToFrameUnderCursor
      ? this.getTopLayerFrameAtSceneCoords({
          x: gridX,
          y: gridY,
        })
      : null;

    const element = newImageElement({
      type: "image",
      x: gridX,
      y: gridY,
      strokeColor: this.state.currentItemStrokeColor,
      backgroundColor: this.state.currentItemBackgroundColor,
      fillStyle: this.state.currentItemFillStyle,
      strokeWidth: this.state.currentItemStrokeWidth,
      strokeStyle: this.state.currentItemStrokeStyle,
      roughness: this.state.currentItemRoughness,
      roundness: null,
      opacity: this.state.currentItemOpacity,
      locked: false,
      frameId: topLayerFrame ? topLayerFrame.id : null,
    });

    return element;
  };

  private handleLinearElementOnPointerDown = (
    event: React.PointerEvent<HTMLElement>,
    elementType: ExcalidrawLinearElement["type"],
    pointerDownState: PointerDownState,
  ): void => {
    if (this.state.multiElement) {
      const { multiElement } = this.state;

      // finalize if completing a loop
      if (
        multiElement.type === "line" &&
        isPathALoop(multiElement.points, this.state.zoom.value)
      ) {
        mutateElement(multiElement, {
          lastCommittedPoint:
            multiElement.points[multiElement.points.length - 1],
        });
        this.actionManager.executeAction(actionFinalize);
        return;
      }

      // Elbow arrows cannot be created by putting down points
      // only the start and end points can be defined
      if (isElbowArrow(multiElement) && multiElement.points.length > 1) {
        mutateElement(multiElement, {
          lastCommittedPoint:
            multiElement.points[multiElement.points.length - 1],
        });
        this.actionManager.executeAction(actionFinalize);
        return;
      }

      const { x: rx, y: ry, lastCommittedPoint } = multiElement;

      // clicking inside commit zone → finalize arrow
      if (
        multiElement.points.length > 1 &&
        lastCommittedPoint &&
        pointDistance(
          pointFrom(
            pointerDownState.origin.x - rx,
            pointerDownState.origin.y - ry,
          ),
          lastCommittedPoint,
        ) < LINE_CONFIRM_THRESHOLD
      ) {
        this.actionManager.executeAction(actionFinalize);
        return;
      }

      this.setState((prevState) => ({
        selectedElementIds: makeNextSelectedElementIds(
          {
            ...prevState.selectedElementIds,
            [multiElement.id]: true,
          },
          prevState,
        ),
      }));
      // clicking outside commit zone → update reference for last committed
      // point
      mutateElement(multiElement, {
        lastCommittedPoint: multiElement.points[multiElement.points.length - 1],
      });
      setCursor(this.interactiveCanvas, CURSOR_TYPE.POINTER);
    } else {
      const [gridX, gridY] = getGridPoint(
        pointerDownState.origin.x,
        pointerDownState.origin.y,
        event[KEYS.CTRL_OR_CMD] ? null : this.getEffectiveGridSize(),
      );

      const topLayerFrame = this.getTopLayerFrameAtSceneCoords({
        x: gridX,
        y: gridY,
      });

      /* If arrow is pre-arrowheads, it will have undefined for both start and end arrowheads.
      If so, we want it to be null for start and "arrow" for end. If the linear item is not
      an arrow, we want it to be null for both. Otherwise, we want it to use the
      values from appState. */

      const { currentItemStartArrowhead, currentItemEndArrowhead } = this.state;
      const [startArrowhead, endArrowhead] =
        elementType === "arrow"
          ? [currentItemStartArrowhead, currentItemEndArrowhead]
          : [null, null];

      const element =
        elementType === "arrow"
          ? newArrowElement({
              type: elementType,
              x: gridX,
              y: gridY,
              strokeColor: this.state.currentItemStrokeColor,
              backgroundColor: this.state.currentItemBackgroundColor,
              fillStyle: this.state.currentItemFillStyle,
              strokeWidth: this.state.currentItemStrokeWidth,
              strokeStyle: this.state.currentItemStrokeStyle,
              roughness: this.state.currentItemRoughness,
              opacity: this.state.currentItemOpacity,
              roundness:
                this.state.currentItemArrowType === ARROW_TYPE.round
                  ? { type: ROUNDNESS.PROPORTIONAL_RADIUS }
                  : // note, roundness doesn't have any effect for elbow arrows,
                    // but it's best to set it to null as well
                    null,
              startArrowhead,
              endArrowhead,
              locked: false,
              frameId: topLayerFrame ? topLayerFrame.id : null,
              elbowed: this.state.currentItemArrowType === ARROW_TYPE.elbow,
            })
          : newLinearElement({
              type: elementType,
              x: gridX,
              y: gridY,
              strokeColor: this.state.currentItemStrokeColor,
              backgroundColor: this.state.currentItemBackgroundColor,
              fillStyle: this.state.currentItemFillStyle,
              strokeWidth: this.state.currentItemStrokeWidth,
              strokeStyle: this.state.currentItemStrokeStyle,
              roughness: this.state.currentItemRoughness,
              opacity: this.state.currentItemOpacity,
              roundness:
                this.state.currentItemRoundness === "round"
                  ? { type: ROUNDNESS.PROPORTIONAL_RADIUS }
                  : null,
              locked: false,
              frameId: topLayerFrame ? topLayerFrame.id : null,
            });
      this.setState((prevState) => {
        const nextSelectedElementIds = {
          ...prevState.selectedElementIds,
        };
        delete nextSelectedElementIds[element.id];
        return {
          selectedElementIds: makeNextSelectedElementIds(
            nextSelectedElementIds,
            prevState,
          ),
        };
      });
      mutateElement(element, {
        points: [...element.points, pointFrom<LocalPoint>(0, 0)],
      });
      const boundElement = getHoveredElementForBinding(
        pointerDownState.origin,
        this.scene.getNonDeletedElements(),
        this.scene.getNonDeletedElementsMap(),
        isElbowArrow(element),
      );

      this.scene.insertElement(element);
      this.setState({
        newElement: element,
        startBoundElement: boundElement,
        suggestedBindings: [],
      });
    }
  };

  private getCurrentItemRoundness(
    elementType:
      | "selection"
      | "rectangle"
      | "diamond"
      | "ellipse"
      | "iframe"
      | "embeddable",
  ) {
    return this.state.currentItemRoundness === "round"
      ? {
          type: isUsingAdaptiveRadius(elementType)
            ? ROUNDNESS.ADAPTIVE_RADIUS
            : ROUNDNESS.PROPORTIONAL_RADIUS,
        }
      : null;
  }

  private createGenericElementOnPointerDown = (
    elementType: ExcalidrawGenericElement["type"] | "embeddable",
    pointerDownState: PointerDownState,
  ): void => {
    const [gridX, gridY] = getGridPoint(
      pointerDownState.origin.x,
      pointerDownState.origin.y,
      this.lastPointerDownEvent?.[KEYS.CTRL_OR_CMD]
        ? null
        : this.getEffectiveGridSize(),
    );

    const topLayerFrame = this.getTopLayerFrameAtSceneCoords({
      x: gridX,
      y: gridY,
    });

    const baseElementAttributes = {
      x: gridX,
      y: gridY,
      strokeColor: this.state.currentItemStrokeColor,
      backgroundColor: this.state.currentItemBackgroundColor,
      fillStyle: this.state.currentItemFillStyle,
      strokeWidth: this.state.currentItemStrokeWidth,
      strokeStyle: this.state.currentItemStrokeStyle,
      roughness: this.state.currentItemRoughness,
      opacity: this.state.currentItemOpacity,
      roundness: this.getCurrentItemRoundness(elementType),
      locked: false,
      frameId: topLayerFrame ? topLayerFrame.id : null,
    } as const;

    let element;
    if (elementType === "embeddable") {
      element = newEmbeddableElement({
        type: "embeddable",
        ...baseElementAttributes,
      });
    } else {
      element = newElement({
        type: elementType,
        ...baseElementAttributes,
      });
    }

    if (element.type === "selection") {
      this.setState({
        selectionElement: element,
      });
    } else {
      this.scene.insertElement(element);
      this.setState({
        multiElement: null,
        newElement: element,
      });
    }
  };

  private createFrameElementOnPointerDown = (
    pointerDownState: PointerDownState,
    type: Extract<ToolType, "frame" | "magicframe">,
  ): void => {
    const [gridX, gridY] = getGridPoint(
      pointerDownState.origin.x,
      pointerDownState.origin.y,
      this.lastPointerDownEvent?.[KEYS.CTRL_OR_CMD]
        ? null
        : this.getEffectiveGridSize(),
    );

    const constructorOpts = {
      x: gridX,
      y: gridY,
      opacity: this.state.currentItemOpacity,
      locked: false,
      ...FRAME_STYLE,
    } as const;

    const frame =
      type === TOOL_TYPE.magicframe
        ? newMagicFrameElement(constructorOpts)
        : newFrameElement(constructorOpts);

    this.scene.insertElement(frame);

    this.setState({
      multiElement: null,
      newElement: frame,
    });
  };

  private maybeCacheReferenceSnapPoints(
    event: KeyboardModifiersObject,
    selectedElements: ExcalidrawElement[],
    recomputeAnyways: boolean = false,
  ) {
    if (
      isSnappingEnabled({
        event,
        app: this,
        selectedElements,
      }) &&
      (recomputeAnyways || !SnapCache.getReferenceSnapPoints())
    ) {
      SnapCache.setReferenceSnapPoints(
        getReferenceSnapPoints(
          this.scene.getNonDeletedElements(),
          selectedElements,
          this.state,
          this.scene.getNonDeletedElementsMap(),
        ),
      );
    }
  }

  private maybeCacheVisibleGaps(
    event: KeyboardModifiersObject,
    selectedElements: ExcalidrawElement[],
    recomputeAnyways: boolean = false,
  ) {
    if (
      isSnappingEnabled({
        event,
        app: this,
        selectedElements,
      }) &&
      (recomputeAnyways || !SnapCache.getVisibleGaps())
    ) {
      SnapCache.setVisibleGaps(
        getVisibleGaps(
          this.scene.getNonDeletedElements(),
          selectedElements,
          this.state,
          this.scene.getNonDeletedElementsMap(),
        ),
      );
    }
  }

  private onKeyDownFromPointerDownHandler(
    pointerDownState: PointerDownState,
  ): (event: KeyboardEvent) => void {
    return withBatchedUpdates((event: KeyboardEvent) => {
      if (this.maybeHandleResize(pointerDownState, event)) {
        return;
      }
      this.maybeDragNewGenericElement(pointerDownState, event);
    });
  }

  private onKeyUpFromPointerDownHandler(
    pointerDownState: PointerDownState,
  ): (event: KeyboardEvent) => void {
    return withBatchedUpdates((event: KeyboardEvent) => {
      // Prevents focus from escaping excalidraw tab
      event.key === KEYS.ALT && event.preventDefault();
      if (this.maybeHandleResize(pointerDownState, event)) {
        return;
      }
      this.maybeDragNewGenericElement(pointerDownState, event);
    });
  }

  private onPointerMoveFromPointerDownHandler(
    pointerDownState: PointerDownState,
  ) {
    return withBatchedUpdatesThrottled((event: PointerEvent) => {
      const pointerCoords = viewportCoordsToSceneCoords(event, this.state);
      const lastPointerCoords =
        this.lastPointerMoveCoords ?? pointerDownState.origin;
      this.lastPointerMoveCoords = pointerCoords;

      // We need to initialize dragOffsetXY only after we've updated
      // `state.selectedElementIds` on pointerDown. Doing it here in pointerMove
      // event handler should hopefully ensure we're already working with
      // the updated state.
      if (pointerDownState.drag.offset === null) {
        pointerDownState.drag.offset = tupleToCoors(
          getDragOffsetXY(
            this.scene.getSelectedElements(this.state),
            pointerDownState.origin.x,
            pointerDownState.origin.y,
          ),
        );
      }
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (this.handlePointerMoveOverScrollbars(event, pointerDownState)) {
        return;
      }

      if (isEraserActive(this.state)) {
        this.handleEraser(event, pointerDownState, pointerCoords);
        return;
      }

      if (this.state.activeTool.type === "laser") {
        this.laserTrails.addPointToPath(pointerCoords.x, pointerCoords.y);
      }

      const [gridX, gridY] = getGridPoint(
        pointerCoords.x,
        pointerCoords.y,
        event[KEYS.CTRL_OR_CMD] ? null : this.getEffectiveGridSize(),
      );

      // for arrows/lines, don't start dragging until a given threshold
      // to ensure we don't create a 2-point arrow by mistake when
      // user clicks mouse in a way that it moves a tiny bit (thus
      // triggering pointermove)
      if (
        !pointerDownState.drag.hasOccurred &&
        (this.state.activeTool.type === "arrow" ||
          this.state.activeTool.type === "line")
      ) {
        if (
          pointDistance(
            pointFrom(pointerCoords.x, pointerCoords.y),
            pointFrom(pointerDownState.origin.x, pointerDownState.origin.y),
          ) < DRAGGING_THRESHOLD
        ) {
          return;
        }
      }
      if (pointerDownState.resize.isResizing) {
        pointerDownState.lastCoords.x = pointerCoords.x;
        pointerDownState.lastCoords.y = pointerCoords.y;
        if (this.maybeHandleCrop(pointerDownState, event)) {
          return true;
        }
        if (this.maybeHandleResize(pointerDownState, event)) {
          return true;
        }
      }
      const elementsMap = this.scene.getNonDeletedElementsMap();

      if (this.state.selectedLinearElement) {
        const linearElementEditor =
          this.state.editingLinearElement || this.state.selectedLinearElement;

        if (
          LinearElementEditor.shouldAddMidpoint(
            this.state.selectedLinearElement,
            pointerCoords,
            this.state,
            elementsMap,
          )
        ) {
          const ret = LinearElementEditor.addMidpoint(
            this.state.selectedLinearElement,
            pointerCoords,
            this,
            !event[KEYS.CTRL_OR_CMD],
            elementsMap,
          );
          if (!ret) {
            return;
          }

          // Since we are reading from previous state which is not possible with
          // automatic batching in React 18 hence using flush sync to synchronously
          // update the state. Check https://github.com/excalidraw/excalidraw/pull/5508 for more details.

          flushSync(() => {
            if (this.state.selectedLinearElement) {
              this.setState({
                selectedLinearElement: {
                  ...this.state.selectedLinearElement,
                  pointerDownState: ret.pointerDownState,
                  selectedPointsIndices: ret.selectedPointsIndices,
                },
              });
            }
            if (this.state.editingLinearElement) {
              this.setState({
                editingLinearElement: {
                  ...this.state.editingLinearElement,
                  pointerDownState: ret.pointerDownState,
                  selectedPointsIndices: ret.selectedPointsIndices,
                },
              });
            }
          });

          return;
        } else if (
          linearElementEditor.pointerDownState.segmentMidpoint.value !== null &&
          !linearElementEditor.pointerDownState.segmentMidpoint.added
        ) {
          return;
        }

        const didDrag = LinearElementEditor.handlePointDragging(
          event,
          this,
          pointerCoords.x,
          pointerCoords.y,
          (element, pointsSceneCoords) => {
            this.maybeSuggestBindingsForLinearElementAtCoords(
              element,
              pointsSceneCoords,
            );
          },
          linearElementEditor,
          this.scene,
        );
        if (didDrag) {
          pointerDownState.lastCoords.x = pointerCoords.x;
          pointerDownState.lastCoords.y = pointerCoords.y;
          pointerDownState.drag.hasOccurred = true;
          if (
            this.state.editingLinearElement &&
            !this.state.editingLinearElement.isDragging
          ) {
            this.setState({
              editingLinearElement: {
                ...this.state.editingLinearElement,
                isDragging: true,
              },
            });
          }
          if (!this.state.selectedLinearElement.isDragging) {
            this.setState({
              selectedLinearElement: {
                ...this.state.selectedLinearElement,
                isDragging: true,
              },
            });
          }
          return;
        }
      }

      const hasHitASelectedElement = pointerDownState.hit.allHitElements.some(
        (element) => this.isASelectedElement(element),
      );

      const isSelectingPointsInLineEditor =
        this.state.editingLinearElement &&
        event.shiftKey &&
        this.state.editingLinearElement.elementId ===
          pointerDownState.hit.element?.id;
      if (
        (hasHitASelectedElement ||
          pointerDownState.hit.hasHitCommonBoundingBoxOfSelectedElements) &&
        !isSelectingPointsInLineEditor
      ) {
        const selectedElements = this.scene.getSelectedElements(this.state);

        if (selectedElements.every((element) => element.locked)) {
          return;
        }

        const selectedElementsHasAFrame = selectedElements.find((e) =>
          isFrameLikeElement(e),
        );
        const topLayerFrame = this.getTopLayerFrameAtSceneCoords(pointerCoords);
        const frameToHighlight =
          topLayerFrame && !selectedElementsHasAFrame ? topLayerFrame : null;
        // Only update the state if there is a difference
        if (this.state.frameToHighlight !== frameToHighlight) {
          flushSync(() => {
            this.setState({ frameToHighlight });
          });
        }

        // Marking that click was used for dragging to check
        // if elements should be deselected on pointerup
        pointerDownState.drag.hasOccurred = true;

        // prevent dragging even if we're no longer holding cmd/ctrl otherwise
        // it would have weird results (stuff jumping all over the screen)
        // Checking for editingTextElement to avoid jump while editing on mobile #6503
        if (
          selectedElements.length > 0 &&
          !pointerDownState.withCmdOrCtrl &&
          !this.state.editingTextElement &&
          this.state.activeEmbeddable?.state !== "active"
        ) {
          const dragOffset = {
            x: pointerCoords.x - pointerDownState.origin.x,
            y: pointerCoords.y - pointerDownState.origin.y,
          };

          const originalElements = [
            ...pointerDownState.originalElements.values(),
          ];

          // We only drag in one direction if shift is pressed
          const lockDirection = event.shiftKey;

          if (lockDirection) {
            const distanceX = Math.abs(dragOffset.x);
            const distanceY = Math.abs(dragOffset.y);

            const lockX = lockDirection && distanceX < distanceY;
            const lockY = lockDirection && distanceX > distanceY;

            if (lockX) {
              dragOffset.x = 0;
            }

            if (lockY) {
              dragOffset.y = 0;
            }
          }

          // #region move crop region
          if (this.state.croppingElementId) {
            const croppingElement = this.scene
              .getNonDeletedElementsMap()
              .get(this.state.croppingElementId);

            if (
              croppingElement &&
              isImageElement(croppingElement) &&
              croppingElement.crop !== null &&
              pointerDownState.hit.element === croppingElement
            ) {
              const crop = croppingElement.crop;
              const image =
                isInitializedImageElement(croppingElement) &&
                this.imageCache.get(croppingElement.fileId)?.image;

              if (image && !(image instanceof Promise)) {
                const instantDragOffset = vectorScale(
                  vector(
                    pointerCoords.x - lastPointerCoords.x,
                    pointerCoords.y - lastPointerCoords.y,
                  ),
                  Math.max(this.state.zoom.value, 2),
                );

                const [x1, y1, x2, y2, cx, cy] = getElementAbsoluteCoords(
                  croppingElement,
                  elementsMap,
                );

                const topLeft = vectorFromPoint(
                  pointRotateRads(
                    pointFrom(x1, y1),
                    pointFrom(cx, cy),
                    croppingElement.angle,
                  ),
                );
                const topRight = vectorFromPoint(
                  pointRotateRads(
                    pointFrom(x2, y1),
                    pointFrom(cx, cy),
                    croppingElement.angle,
                  ),
                );
                const bottomLeft = vectorFromPoint(
                  pointRotateRads(
                    pointFrom(x1, y2),
                    pointFrom(cx, cy),
                    croppingElement.angle,
                  ),
                );
                const topEdge = vectorNormalize(
                  vectorSubtract(topRight, topLeft),
                );
                const leftEdge = vectorNormalize(
                  vectorSubtract(bottomLeft, topLeft),
                );

                // project instantDrafOffset onto leftEdge and topEdge to decompose
                const offsetVector = vector(
                  vectorDot(instantDragOffset, topEdge),
                  vectorDot(instantDragOffset, leftEdge),
                );

                const nextCrop = {
                  ...crop,
                  x: clamp(
                    crop.x -
                      offsetVector[0] * Math.sign(croppingElement.scale[0]),
                    0,
                    image.naturalWidth - crop.width,
                  ),
                  y: clamp(
                    crop.y -
                      offsetVector[1] * Math.sign(croppingElement.scale[1]),
                    0,
                    image.naturalHeight - crop.height,
                  ),
                };

                mutateElement(croppingElement, {
                  crop: nextCrop,
                });

                return;
              }
            }
          }

          // Snap cache *must* be synchronously popuplated before initial drag,
          // otherwise the first drag even will not snap, causing a jump before
          // it snaps to its position if previously snapped already.
          this.maybeCacheVisibleGaps(event, selectedElements);
          this.maybeCacheReferenceSnapPoints(event, selectedElements);

          const { snapOffset, snapLines } = snapDraggedElements(
            originalElements,
            dragOffset,
            this,
            event,
            this.scene.getNonDeletedElementsMap(),
          );

          flushSync(() => {
            this.setState({ snapLines });
          });

          // when we're editing the name of a frame, we want the user to be
          // able to select and interact with the text input
          !this.state.editingFrame &&
            dragSelectedElements(
              pointerDownState,
              selectedElements,
              dragOffset,
              this.scene,
              snapOffset,
              event[KEYS.CTRL_OR_CMD] ? null : this.getEffectiveGridSize(),
            );

          this.setState({
            selectedElementsAreBeingDragged: true,
            // element is being dragged and selectionElement that was created on pointer down
            // should be removed
            selectionElement: null,
          });

          if (
            selectedElements.length !== 1 ||
            !isElbowArrow(selectedElements[0])
          ) {
            this.setState({
              suggestedBindings: getSuggestedBindingsForArrows(
                selectedElements,
                this.scene.getNonDeletedElementsMap(),
              ),
            });
          }

          // We duplicate the selected element if alt is pressed on pointer move
          if (event.altKey && !pointerDownState.hit.hasBeenDuplicated) {
            // Move the currently selected elements to the top of the z index stack, and
            // put the duplicates where the selected elements used to be.
            // (the origin point where the dragging started)

            pointerDownState.hit.hasBeenDuplicated = true;

            const nextElements = [];
            const elementsToAppend = [];
            const groupIdMap = new Map();
            const oldIdToDuplicatedId = new Map();
            const hitElement = pointerDownState.hit.element;
            const selectedElementIds = new Set(
              this.scene
                .getSelectedElements({
                  selectedElementIds: this.state.selectedElementIds,
                  includeBoundTextElement: true,
                  includeElementsInFrames: true,
                })
                .map((element) => element.id),
            );

            const elements = this.scene.getElementsIncludingDeleted();

            for (const element of elements) {
              if (
                selectedElementIds.has(element.id) ||
                // case: the state.selectedElementIds might not have been
                // updated yet by the time this mousemove event is fired
                (element.id === hitElement?.id &&
                  pointerDownState.hit.wasAddedToSelection)
              ) {
                const duplicatedElement = duplicateElement(
                  this.state.editingGroupId,
                  groupIdMap,
                  element,
                );
                const origElement = pointerDownState.originalElements.get(
                  element.id,
                )!;
                mutateElement(duplicatedElement, {
                  x: origElement.x,
                  y: origElement.y,
                });

                // put duplicated element to pointerDownState.originalElements
                // so that we can snap to the duplicated element without releasing
                pointerDownState.originalElements.set(
                  duplicatedElement.id,
                  duplicatedElement,
                );

                nextElements.push(duplicatedElement);
                elementsToAppend.push(element);
                oldIdToDuplicatedId.set(element.id, duplicatedElement.id);
              } else {
                nextElements.push(element);
              }
            }

            const nextSceneElements = [...nextElements, ...elementsToAppend];

            syncMovedIndices(nextSceneElements, arrayToMap(elementsToAppend));

            bindTextToShapeAfterDuplication(
              nextElements,
              elementsToAppend,
              oldIdToDuplicatedId,
            );
            fixBindingsAfterDuplication(
              nextSceneElements,
              elementsToAppend,
              oldIdToDuplicatedId,
              "duplicatesServeAsOld",
            );
            bindElementsToFramesAfterDuplication(
              nextSceneElements,
              elementsToAppend,
              oldIdToDuplicatedId,
            );

            this.scene.replaceAllElements(nextSceneElements);
            this.maybeCacheVisibleGaps(event, selectedElements, true);
            this.maybeCacheReferenceSnapPoints(event, selectedElements, true);
          }

          return;
        }
      }

      if (this.state.selectionElement) {
        pointerDownState.lastCoords.x = pointerCoords.x;
        pointerDownState.lastCoords.y = pointerCoords.y;
        this.maybeDragNewGenericElement(pointerDownState, event);
      } else {
        // It is very important to read this.state within each move event,
        // otherwise we would read a stale one!
        const newElement = this.state.newElement;

        if (!newElement) {
          return;
        }

        if (newElement.type === "freedraw") {
          const points = newElement.points;
          const dx = pointerCoords.x - newElement.x;
          const dy = pointerCoords.y - newElement.y;

          const lastPoint = points.length > 0 && points[points.length - 1];
          const discardPoint =
            lastPoint && lastPoint[0] === dx && lastPoint[1] === dy;

          if (!discardPoint) {
            const pressures = newElement.simulatePressure
              ? newElement.pressures
              : [...newElement.pressures, event.pressure];

            mutateElement(
              newElement,
              {
                points: [...points, pointFrom<LocalPoint>(dx, dy)],
                pressures,
              },
              false,
            );

            this.setState({
              newElement,
            });
          }
        } else if (isLinearElement(newElement)) {
          pointerDownState.drag.hasOccurred = true;
          const points = newElement.points;
          let dx = gridX - newElement.x;
          let dy = gridY - newElement.y;

          if (shouldRotateWithDiscreteAngle(event) && points.length === 2) {
            ({ width: dx, height: dy } = getLockedLinearCursorAlignSize(
              newElement.x,
              newElement.y,
              pointerCoords.x,
              pointerCoords.y,
            ));
          }

          if (points.length === 1) {
            mutateElement(
              newElement,
              {
                points: [...points, pointFrom<LocalPoint>(dx, dy)],
              },
              false,
            );
          } else if (points.length > 1 && isElbowArrow(newElement)) {
            mutateElbowArrow(
              newElement,
              elementsMap,
              [...points.slice(0, -1), pointFrom<LocalPoint>(dx, dy)],
              vector(0, 0),
              undefined,
              {
                isDragging: true,
                informMutation: false,
              },
            );
          } else if (points.length === 2) {
            mutateElement(
              newElement,
              {
                points: [...points.slice(0, -1), pointFrom<LocalPoint>(dx, dy)],
              },
              false,
            );
          }

          this.setState({
            newElement,
          });

          if (isBindingElement(newElement, false)) {
            // When creating a linear element by dragging
            this.maybeSuggestBindingsForLinearElementAtCoords(
              newElement,
              [pointerCoords],
              this.state.startBoundElement,
            );
          }
        } else {
          pointerDownState.lastCoords.x = pointerCoords.x;
          pointerDownState.lastCoords.y = pointerCoords.y;
          this.maybeDragNewGenericElement(pointerDownState, event, false);
        }
      }

      if (this.state.activeTool.type === "selection") {
        pointerDownState.boxSelection.hasOccurred = true;

        const elements = this.scene.getNonDeletedElements();

        // box-select line editor points
        if (this.state.editingLinearElement) {
          LinearElementEditor.handleBoxSelection(
            event,
            this.state,
            this.setState.bind(this),
            this.scene.getNonDeletedElementsMap(),
          );
          // regular box-select
        } else {
          let shouldReuseSelection = true;

          if (!event.shiftKey && isSomeElementSelected(elements, this.state)) {
            if (
              pointerDownState.withCmdOrCtrl &&
              pointerDownState.hit.element
            ) {
              this.setState((prevState) =>
                selectGroupsForSelectedElements(
                  {
                    ...prevState,
                    selectedElementIds: {
                      [pointerDownState.hit.element!.id]: true,
                    },
                  },
                  this.scene.getNonDeletedElements(),
                  prevState,
                  this,
                ),
              );
            } else {
              shouldReuseSelection = false;
            }
          }
          const elementsWithinSelection = this.state.selectionElement
            ? getElementsWithinSelection(
                elements,
                this.state.selectionElement,
                this.scene.getNonDeletedElementsMap(),
              )
            : [];

          this.setState((prevState) => {
            const nextSelectedElementIds = {
              ...(shouldReuseSelection && prevState.selectedElementIds),
              ...elementsWithinSelection.reduce(
                (acc: Record<ExcalidrawElement["id"], true>, element) => {
                  acc[element.id] = true;
                  return acc;
                },
                {},
              ),
            };

            if (pointerDownState.hit.element) {
              // if using ctrl/cmd, select the hitElement only if we
              // haven't box-selected anything else
              if (!elementsWithinSelection.length) {
                nextSelectedElementIds[pointerDownState.hit.element.id] = true;
              } else {
                delete nextSelectedElementIds[pointerDownState.hit.element.id];
              }
            }

            prevState = !shouldReuseSelection
              ? { ...prevState, selectedGroupIds: {}, editingGroupId: null }
              : prevState;

            return {
              ...selectGroupsForSelectedElements(
                {
                  editingGroupId: prevState.editingGroupId,
                  selectedElementIds: nextSelectedElementIds,
                },
                this.scene.getNonDeletedElements(),
                prevState,
                this,
              ),
              // select linear element only when we haven't box-selected anything else
              selectedLinearElement:
                elementsWithinSelection.length === 1 &&
                isLinearElement(elementsWithinSelection[0])
                  ? new LinearElementEditor(elementsWithinSelection[0])
                  : null,
              showHyperlinkPopup:
                elementsWithinSelection.length === 1 &&
                (elementsWithinSelection[0].link ||
                  isEmbeddableElement(elementsWithinSelection[0]))
                  ? "info"
                  : false,
            };
          });
        }
      }
    });
  }

  // Returns whether the pointer move happened over either scrollbar
  private handlePointerMoveOverScrollbars(
    event: PointerEvent,
    pointerDownState: PointerDownState,
  ): boolean {
    if (pointerDownState.scrollbars.isOverHorizontal) {
      const x = event.clientX;
      const dx = x - pointerDownState.lastCoords.x;
      this.translateCanvas({
        scrollX: this.state.scrollX - dx / this.state.zoom.value,
      });
      pointerDownState.lastCoords.x = x;
      return true;
    }

    if (pointerDownState.scrollbars.isOverVertical) {
      const y = event.clientY;
      const dy = y - pointerDownState.lastCoords.y;
      this.translateCanvas({
        scrollY: this.state.scrollY - dy / this.state.zoom.value,
      });
      pointerDownState.lastCoords.y = y;
      return true;
    }
    return false;
  }

  private onPointerUpFromPointerDownHandler(
    pointerDownState: PointerDownState,
  ): (event: PointerEvent) => void {
    return withBatchedUpdates((childEvent: PointerEvent) => {
      this.removePointer(childEvent);
      if (pointerDownState.eventListeners.onMove) {
        pointerDownState.eventListeners.onMove.flush();
      }
      const {
        newElement,
        resizingElement,
        croppingElementId,
        multiElement,
        activeTool,
        isResizing,
        isRotating,
        isCropping,
      } = this.state;

      this.setState((prevState) => ({
        isResizing: false,
        isRotating: false,
        isCropping: false,
        resizingElement: null,
        selectionElement: null,
        frameToHighlight: null,
        elementsToHighlight: null,
        cursorButton: "up",
        snapLines: updateStable(prevState.snapLines, []),
        originSnapOffset: null,
      }));

      this.lastPointerMoveCoords = null;

      SnapCache.setReferenceSnapPoints(null);
      SnapCache.setVisibleGaps(null);

      this.savePointer(childEvent.clientX, childEvent.clientY, "up");

      this.setState({
        selectedElementsAreBeingDragged: false,
      });
      const elementsMap = this.scene.getNonDeletedElementsMap();
      // Handle end of dragging a point of a linear element, might close a loop
      // and sets binding element
      if (this.state.editingLinearElement) {
        if (
          !pointerDownState.boxSelection.hasOccurred &&
          pointerDownState.hit?.element?.id !==
            this.state.editingLinearElement.elementId
        ) {
          this.actionManager.executeAction(actionFinalize);
        } else {
          const editingLinearElement = LinearElementEditor.handlePointerUp(
            childEvent,
            this.state.editingLinearElement,
            this.state,
            this.scene,
          );
          if (editingLinearElement !== this.state.editingLinearElement) {
            this.setState({
              editingLinearElement,
              suggestedBindings: [],
            });
          }
        }
      } else if (this.state.selectedLinearElement) {
        if (
          pointerDownState.hit?.element?.id !==
          this.state.selectedLinearElement.elementId
        ) {
          const selectedELements = this.scene.getSelectedElements(this.state);
          // set selectedLinearElement to null if there is more than one element selected since we don't want to show linear element handles
          if (selectedELements.length > 1) {
            this.setState({ selectedLinearElement: null });
          }
        } else {
          const linearElementEditor = LinearElementEditor.handlePointerUp(
            childEvent,
            this.state.selectedLinearElement,
            this.state,
            this.scene,
          );

          const { startBindingElement, endBindingElement } =
            linearElementEditor;
          const element = this.scene.getElement(linearElementEditor.elementId);
          if (isBindingElement(element)) {
            bindOrUnbindLinearElement(
              element,
              startBindingElement,
              endBindingElement,
              elementsMap,
              this.scene,
            );
          }

          if (linearElementEditor !== this.state.selectedLinearElement) {
            this.setState({
              selectedLinearElement: {
                ...linearElementEditor,
                selectedPointsIndices: null,
              },
              suggestedBindings: [],
            });
          }
        }
      }

      this.missingPointerEventCleanupEmitter.clear();

      window.removeEventListener(
        EVENT.POINTER_MOVE,
        pointerDownState.eventListeners.onMove!,
      );
      window.removeEventListener(
        EVENT.POINTER_UP,
        pointerDownState.eventListeners.onUp!,
      );
      window.removeEventListener(
        EVENT.KEYDOWN,
        pointerDownState.eventListeners.onKeyDown!,
      );
      window.removeEventListener(
        EVENT.KEYUP,
        pointerDownState.eventListeners.onKeyUp!,
      );

      if (this.state.pendingImageElementId) {
        this.setState({ pendingImageElementId: null });
      }

      this.props?.onPointerUp?.(activeTool, pointerDownState);
      this.onPointerUpEmitter.trigger(
        this.state.activeTool,
        pointerDownState,
        childEvent,
      );

      if (newElement?.type === "freedraw") {
        const pointerCoords = viewportCoordsToSceneCoords(
          childEvent,
          this.state,
        );

        const points = newElement.points;
        let dx = pointerCoords.x - newElement.x;
        let dy = pointerCoords.y - newElement.y;

        // Allows dots to avoid being flagged as infinitely small
        if (dx === points[0][0] && dy === points[0][1]) {
          dy += 0.0001;
          dx += 0.0001;
        }

        const pressures = newElement.simulatePressure
          ? []
          : [...newElement.pressures, childEvent.pressure];

        mutateElement(newElement, {
          points: [...points, pointFrom<LocalPoint>(dx, dy)],
          pressures,
          lastCommittedPoint: pointFrom<LocalPoint>(dx, dy),
        });

        this.actionManager.executeAction(actionFinalize);

        return;
      }
      if (isImageElement(newElement)) {
        const imageElement = newElement;
        try {
          this.initializeImageDimensions(imageElement);
          this.setState(
            {
              selectedElementIds: makeNextSelectedElementIds(
                { [imageElement.id]: true },
                this.state,
              ),
            },
            () => {
              this.actionManager.executeAction(actionFinalize);
            },
          );
        } catch (error: any) {
          console.error(error);
          this.scene.replaceAllElements(
            this.scene
              .getElementsIncludingDeleted()
              .filter((el) => el.id !== imageElement.id),
          );
          this.actionManager.executeAction(actionFinalize);
        }
        return;
      }

      if (isLinearElement(newElement)) {
        if (newElement!.points.length > 1) {
          this.store.shouldCaptureIncrement();
        }
        const pointerCoords = viewportCoordsToSceneCoords(
          childEvent,
          this.state,
        );

        if (!pointerDownState.drag.hasOccurred && newElement && !multiElement) {
          mutateElement(newElement, {
            points: [
              ...newElement.points,
              pointFrom<LocalPoint>(
                pointerCoords.x - newElement.x,
                pointerCoords.y - newElement.y,
              ),
            ],
          });
          this.setState({
            multiElement: newElement,
            newElement,
          });
        } else if (pointerDownState.drag.hasOccurred && !multiElement) {
          if (
            isBindingEnabled(this.state) &&
            isBindingElement(newElement, false)
          ) {
            maybeBindLinearElement(
              newElement,
              this.state,
              pointerCoords,
              this.scene.getNonDeletedElementsMap(),
              this.scene.getNonDeletedElements(),
            );
          }
          this.setState({ suggestedBindings: [], startBoundElement: null });
          if (!activeTool.locked) {
            resetCursor(this.interactiveCanvas);
            this.setState((prevState) => ({
              newElement: null,
              activeTool: updateActiveTool(this.state, {
                type: "selection",
              }),
              selectedElementIds: makeNextSelectedElementIds(
                {
                  ...prevState.selectedElementIds,
                  [newElement.id]: true,
                },
                prevState,
              ),
              selectedLinearElement: new LinearElementEditor(newElement),
            }));
          } else {
            this.setState((prevState) => ({
              newElement: null,
            }));
          }
          // so that the scene gets rendered again to display the newly drawn linear as well
          this.scene.triggerUpdate();
        }
        return;
      }

      if (isTextElement(newElement)) {
        const minWidth = getMinTextElementWidth(
          getFontString({
            fontSize: newElement.fontSize,
            fontFamily: newElement.fontFamily,
          }),
          newElement.lineHeight,
        );

        if (newElement.width < minWidth) {
          mutateElement(newElement, {
            autoResize: true,
          });
        }

        this.resetCursor();

        this.handleTextWysiwyg(newElement, {
          isExistingElement: true,
        });
      }

      if (
        activeTool.type !== "selection" &&
        newElement &&
        isInvisiblySmallElement(newElement)
      ) {
        // remove invisible element which was added in onPointerDown
        // update the store snapshot, so that invisible elements are not captured by the store
        this.updateScene({
          elements: this.scene
            .getElementsIncludingDeleted()
            .filter((el) => el.id !== newElement.id),
          appState: {
            newElement: null,
          },
          storeAction: StoreAction.UPDATE,
        });

        return;
      }

      if (isFrameLikeElement(newElement)) {
        const elementsInsideFrame = getElementsInNewFrame(
          this.scene.getElementsIncludingDeleted(),
          newElement,
          this.scene.getNonDeletedElementsMap(),
        );

        this.scene.replaceAllElements(
          addElementsToFrame(
            this.scene.getElementsMapIncludingDeleted(),
            elementsInsideFrame,
            newElement,
          ),
        );
      }

      if (newElement) {
        mutateElement(newElement, getNormalizedDimensions(newElement));
        // the above does not guarantee the scene to be rendered again, hence the trigger below
        this.scene.triggerUpdate();
      }

      if (pointerDownState.drag.hasOccurred) {
        const sceneCoords = viewportCoordsToSceneCoords(childEvent, this.state);

        // when editing the points of a linear element, we check if the
        // linear element still is in the frame afterwards
        // if not, the linear element will be removed from its frame (if any)
        if (
          this.state.selectedLinearElement &&
          this.state.selectedLinearElement.isDragging
        ) {
          const linearElement = this.scene.getElement(
            this.state.selectedLinearElement.elementId,
          );

          if (linearElement?.frameId) {
            const frame = getContainingFrame(linearElement, elementsMap);

            if (frame && linearElement) {
              if (
                !elementOverlapsWithFrame(
                  linearElement,
                  frame,
                  this.scene.getNonDeletedElementsMap(),
                )
              ) {
                // remove the linear element from all groups
                // before removing it from the frame as well
                mutateElement(linearElement, {
                  groupIds: [],
                });

                removeElementsFromFrame(
                  [linearElement],
                  this.scene.getNonDeletedElementsMap(),
                );

                this.scene.triggerUpdate();
              }
            }
          }
        } else {
          // update the relationships between selected elements and frames
          const topLayerFrame = this.getTopLayerFrameAtSceneCoords(sceneCoords);

          const selectedElements = this.scene.getSelectedElements(this.state);
          let nextElements = this.scene.getElementsMapIncludingDeleted();

          const updateGroupIdsAfterEditingGroup = (
            elements: ExcalidrawElement[],
          ) => {
            if (elements.length > 0) {
              for (const element of elements) {
                const index = element.groupIds.indexOf(
                  this.state.editingGroupId!,
                );

                mutateElement(
                  element,
                  {
                    groupIds: element.groupIds.slice(0, index),
                  },
                  false,
                );
              }

              nextElements.forEach((element) => {
                if (
                  element.groupIds.length &&
                  getElementsInGroup(
                    nextElements,
                    element.groupIds[element.groupIds.length - 1],
                  ).length < 2
                ) {
                  mutateElement(
                    element,
                    {
                      groupIds: [],
                    },
                    false,
                  );
                }
              });

              this.setState({
                editingGroupId: null,
              });
            }
          };

          if (
            topLayerFrame &&
            !this.state.selectedElementIds[topLayerFrame.id]
          ) {
            const elementsToAdd = selectedElements.filter(
              (element) =>
                element.frameId !== topLayerFrame.id &&
                isElementInFrame(element, nextElements, this.state),
            );

            if (this.state.editingGroupId) {
              updateGroupIdsAfterEditingGroup(elementsToAdd);
            }

            nextElements = addElementsToFrame(
              nextElements,
              elementsToAdd,
              topLayerFrame,
            );
          } else if (!topLayerFrame) {
            if (this.state.editingGroupId) {
              const elementsToRemove = selectedElements.filter(
                (element) =>
                  element.frameId &&
                  !isElementInFrame(element, nextElements, this.state),
              );

              updateGroupIdsAfterEditingGroup(elementsToRemove);
            }
          }

          nextElements = updateFrameMembershipOfSelectedElements(
            nextElements,
            this.state,
            this,
          );

          this.scene.replaceAllElements(nextElements);
        }
      }

      if (resizingElement) {
        this.store.shouldCaptureIncrement();
      }

      if (resizingElement && isInvisiblySmallElement(resizingElement)) {
        // update the store snapshot, so that invisible elements are not captured by the store
        this.updateScene({
          elements: this.scene
            .getElementsIncludingDeleted()
            .filter((el) => el.id !== resizingElement.id),
          storeAction: StoreAction.UPDATE,
        });
      }

      // handle frame membership for resizing frames and/or selected elements
      if (pointerDownState.resize.isResizing) {
        let nextElements = updateFrameMembershipOfSelectedElements(
          this.scene.getElementsIncludingDeleted(),
          this.state,
          this,
        );

        const selectedFrames = this.scene
          .getSelectedElements(this.state)
          .filter((element): element is ExcalidrawFrameLikeElement =>
            isFrameLikeElement(element),
          );

        for (const frame of selectedFrames) {
          nextElements = replaceAllElementsInFrame(
            nextElements,
            getElementsInResizingFrame(
              this.scene.getElementsIncludingDeleted(),
              frame,
              this.state,
              elementsMap,
            ),
            frame,
            this,
          );
        }

        this.scene.replaceAllElements(nextElements);
      }

      // Code below handles selection when element(s) weren't
      // drag or added to selection on pointer down phase.
      const hitElement = pointerDownState.hit.element;
      if (
        this.state.selectedLinearElement?.elementId !== hitElement?.id &&
        isLinearElement(hitElement)
      ) {
        const selectedELements = this.scene.getSelectedElements(this.state);
        // set selectedLinearElement when no other element selected except
        // the one we've hit
        if (selectedELements.length === 1) {
          this.setState({
            selectedLinearElement: new LinearElementEditor(hitElement),
          });
        }
      }

      // click outside the cropping region to exit
      if (
        // not in the cropping mode at all
        !croppingElementId ||
        // in the cropping mode
        (croppingElementId &&
          // not cropping and no hit element
          ((!hitElement && !isCropping) ||
            // hitting something else
            (hitElement && hitElement.id !== croppingElementId)))
      ) {
        this.finishImageCropping();
      }

      const pointerStart = this.lastPointerDownEvent;
      const pointerEnd = this.lastPointerUpEvent || this.lastPointerMoveEvent;

      if (isEraserActive(this.state) && pointerStart && pointerEnd) {
        this.eraserTrail.endPath();

        const draggedDistance = pointDistance(
          pointFrom(pointerStart.clientX, pointerStart.clientY),
          pointFrom(pointerEnd.clientX, pointerEnd.clientY),
        );

        if (draggedDistance === 0) {
          const scenePointer = viewportCoordsToSceneCoords(
            {
              clientX: pointerEnd.clientX,
              clientY: pointerEnd.clientY,
            },
            this.state,
          );
          const hitElements = this.getElementsAtPosition(
            scenePointer.x,
            scenePointer.y,
          );
          hitElements.forEach((hitElement) =>
            this.elementsPendingErasure.add(hitElement.id),
          );
        }
        this.eraseElements();
        return;
      } else if (this.elementsPendingErasure.size) {
        this.restoreReadyToEraseElements();
      }

      if (
        hitElement &&
        !pointerDownState.drag.hasOccurred &&
        !pointerDownState.hit.wasAddedToSelection &&
        // if we're editing a line, pointerup shouldn't switch selection if
        // box selected
        (!this.state.editingLinearElement ||
          !pointerDownState.boxSelection.hasOccurred)
      ) {
        // when inside line editor, shift selects points instead
        if (childEvent.shiftKey && !this.state.editingLinearElement) {
          if (this.state.selectedElementIds[hitElement.id]) {
            if (isSelectedViaGroup(this.state, hitElement)) {
              this.setState((_prevState) => {
                const nextSelectedElementIds = {
                  ..._prevState.selectedElementIds,
                };

                // We want to unselect all groups hitElement is part of
                // as well as all elements that are part of the groups
                // hitElement is part of
                for (const groupedElement of hitElement.groupIds.flatMap(
                  (groupId) =>
                    getElementsInGroup(
                      this.scene.getNonDeletedElements(),
                      groupId,
                    ),
                )) {
                  delete nextSelectedElementIds[groupedElement.id];
                }

                return {
                  selectedGroupIds: {
                    ..._prevState.selectedElementIds,
                    ...hitElement.groupIds
                      .map((gId) => ({ [gId]: false }))
                      .reduce((prev, acc) => ({ ...prev, ...acc }), {}),
                  },
                  selectedElementIds: makeNextSelectedElementIds(
                    nextSelectedElementIds,
                    _prevState,
                  ),
                };
              });
              // if not dragging a linear element point (outside editor)
            } else if (!this.state.selectedLinearElement?.isDragging) {
              // remove element from selection while
              // keeping prev elements selected

              this.setState((prevState) => {
                const newSelectedElementIds = {
                  ...prevState.selectedElementIds,
                };
                delete newSelectedElementIds[hitElement!.id];
                const newSelectedElements = getSelectedElements(
                  this.scene.getNonDeletedElements(),
                  { selectedElementIds: newSelectedElementIds },
                );

                return {
                  ...selectGroupsForSelectedElements(
                    {
                      editingGroupId: prevState.editingGroupId,
                      selectedElementIds: newSelectedElementIds,
                    },
                    this.scene.getNonDeletedElements(),
                    prevState,
                    this,
                  ),
                  // set selectedLinearElement only if thats the only element selected
                  selectedLinearElement:
                    newSelectedElements.length === 1 &&
                    isLinearElement(newSelectedElements[0])
                      ? new LinearElementEditor(newSelectedElements[0])
                      : prevState.selectedLinearElement,
                };
              });
            }
          } else if (
            hitElement.frameId &&
            this.state.selectedElementIds[hitElement.frameId]
          ) {
            // when hitElement is part of a selected frame, deselect the frame
            // to avoid frame and containing elements selected simultaneously
            this.setState((prevState) => {
              const nextSelectedElementIds: {
                [id: string]: true;
              } = {
                ...prevState.selectedElementIds,
                [hitElement.id]: true,
              };
              // deselect the frame
              delete nextSelectedElementIds[hitElement.frameId!];

              // deselect groups containing the frame
              (this.scene.getElement(hitElement.frameId!)?.groupIds ?? [])
                .flatMap((gid) =>
                  getElementsInGroup(this.scene.getNonDeletedElements(), gid),
                )
                .forEach((element) => {
                  delete nextSelectedElementIds[element.id];
                });

              return {
                ...selectGroupsForSelectedElements(
                  {
                    editingGroupId: prevState.editingGroupId,
                    selectedElementIds: nextSelectedElementIds,
                  },
                  this.scene.getNonDeletedElements(),
                  prevState,
                  this,
                ),
                showHyperlinkPopup:
                  hitElement.link || isEmbeddableElement(hitElement)
                    ? "info"
                    : false,
              };
            });
          } else {
            // add element to selection while keeping prev elements selected
            this.setState((_prevState) => ({
              selectedElementIds: makeNextSelectedElementIds(
                {
                  ..._prevState.selectedElementIds,
                  [hitElement!.id]: true,
                },
                _prevState,
              ),
            }));
          }
        } else {
          this.setState((prevState) => ({
            ...selectGroupsForSelectedElements(
              {
                editingGroupId: prevState.editingGroupId,
                selectedElementIds: { [hitElement.id]: true },
              },
              this.scene.getNonDeletedElements(),
              prevState,
              this,
            ),
            selectedLinearElement:
              isLinearElement(hitElement) &&
              // Don't set `selectedLinearElement` if its same as the hitElement, this is mainly to prevent resetting the `hoverPointIndex` to -1.
              // Future we should update the API to take care of setting the correct `hoverPointIndex` when initialized
              prevState.selectedLinearElement?.elementId !== hitElement.id
                ? new LinearElementEditor(hitElement)
                : prevState.selectedLinearElement,
          }));
        }
      }

      if (
        // not dragged
        !pointerDownState.drag.hasOccurred &&
        // not resized
        !this.state.isResizing &&
        // only hitting the bounding box of the previous hit element
        ((hitElement &&
          hitElementBoundingBoxOnly(
            {
              x: pointerDownState.origin.x,
              y: pointerDownState.origin.y,
              element: hitElement,
              shape: getElementShape(
                hitElement,
                this.scene.getNonDeletedElementsMap(),
              ),
              threshold: this.getElementHitThreshold(),
              frameNameBound: isFrameLikeElement(hitElement)
                ? this.frameNameBoundsCache.get(hitElement)
                : null,
            },
            elementsMap,
          )) ||
          (!hitElement &&
            pointerDownState.hit.hasHitCommonBoundingBoxOfSelectedElements))
      ) {
        if (this.state.editingLinearElement) {
          this.setState({ editingLinearElement: null });
        } else {
          // Deselect selected elements
          this.setState({
            selectedElementIds: makeNextSelectedElementIds({}, this.state),
            selectedGroupIds: {},
            editingGroupId: null,
            activeEmbeddable: null,
          });
        }
        // reset cursor
        setCursor(this.interactiveCanvas, CURSOR_TYPE.AUTO);
        return;
      }

      if (!activeTool.locked && activeTool.type !== "freedraw" && newElement) {
        this.setState((prevState) => ({
          selectedElementIds: makeNextSelectedElementIds(
            {
              ...prevState.selectedElementIds,
              [newElement.id]: true,
            },
            prevState,
          ),
          showHyperlinkPopup:
            isEmbeddableElement(newElement) && !newElement.link
              ? "editor"
              : prevState.showHyperlinkPopup,
        }));
      }

      if (
        activeTool.type !== "selection" ||
        isSomeElementSelected(this.scene.getNonDeletedElements(), this.state) ||
        !isShallowEqual(
          this.state.previousSelectedElementIds,
          this.state.selectedElementIds,
        )
      ) {
        this.store.shouldCaptureIncrement();
      }

      if (
        pointerDownState.drag.hasOccurred ||
        isResizing ||
        isRotating ||
        isCropping
      ) {
        // We only allow binding via linear elements, specifically via dragging
        // the endpoints ("start" or "end").
        const linearElements = this.scene
          .getSelectedElements(this.state)
          .filter(isLinearElement);

        bindOrUnbindLinearElements(
          linearElements,
          this.scene.getNonDeletedElementsMap(),
          this.scene.getNonDeletedElements(),
          this.scene,
          isBindingEnabled(this.state),
          this.state.selectedLinearElement?.selectedPointsIndices ?? [],
        );
      }

      if (activeTool.type === "laser") {
        this.laserTrails.endPath();
        return;
      }

      if (!activeTool.locked && activeTool.type !== "freedraw") {
        resetCursor(this.interactiveCanvas);
        this.setState({
          newElement: null,
          suggestedBindings: [],
          activeTool: updateActiveTool(this.state, { type: "selection" }),
        });
      } else {
        this.setState({
          newElement: null,
          suggestedBindings: [],
        });
      }

      if (
        hitElement &&
        this.lastPointerUpEvent &&
        this.lastPointerDownEvent &&
        this.lastPointerUpEvent.timeStamp -
          this.lastPointerDownEvent.timeStamp <
          300 &&
        gesture.pointers.size <= 1 &&
        isIframeLikeElement(hitElement) &&
        this.isIframeLikeElementCenter(
          hitElement,
          this.lastPointerUpEvent,
          pointerDownState.origin.x,
          pointerDownState.origin.y,
        )
      ) {
        this.handleEmbeddableCenterClick(hitElement);
      }
    });
  }

  private restoreReadyToEraseElements = () => {
    this.elementsPendingErasure = new Set();
    this.triggerRender();
  };

  private eraseElements = () => {
    let didChange = false;
    const elements = this.scene.getElementsIncludingDeleted().map((ele) => {
      if (
        this.elementsPendingErasure.has(ele.id) ||
        (ele.frameId && this.elementsPendingErasure.has(ele.frameId)) ||
        (isBoundToContainer(ele) &&
          this.elementsPendingErasure.has(ele.containerId))
      ) {
        didChange = true;
        return newElementWith(ele, { isDeleted: true });
      }
      return ele;
    });

    this.elementsPendingErasure = new Set();

    if (didChange) {
      this.store.shouldCaptureIncrement();
      this.scene.replaceAllElements(elements);
    }
  };

  private initializeImage = async ({
    imageFile,
    imageElement: _imageElement,
    showCursorImagePreview = false,
  }: {
    imageFile: File;
    imageElement: ExcalidrawImageElement;
    showCursorImagePreview?: boolean;
  }) => {
    // at this point this should be guaranteed image file, but we do this check
    // to satisfy TS down the line
    if (!isSupportedImageFile(imageFile)) {
      throw new Error(t("errors.unsupportedFileType"));
    }
    const mimeType = imageFile.type;

    setCursor(this.interactiveCanvas, "wait");

    if (mimeType === MIME_TYPES.svg) {
      try {
        imageFile = SVGStringToFile(
          normalizeSVG(await imageFile.text()),
          imageFile.name,
        );
      } catch (error: any) {
        console.warn(error);
        throw new Error(t("errors.svgImageInsertError"));
      }
    }

    // generate image id (by default the file digest) before any
    // resizing/compression takes place to keep it more portable
    const fileId = await ((this.props.generateIdForFile?.(
      imageFile,
    ) as Promise<FileId>) || generateIdFromFile(imageFile));

    if (!fileId) {
      console.warn(
        "Couldn't generate file id or the supplied `generateIdForFile` didn't resolve to one.",
      );
      throw new Error(t("errors.imageInsertError"));
    }

    const existingFileData = this.files[fileId];
    if (!existingFileData?.dataURL) {
      try {
        imageFile = await resizeImageFile(imageFile, {
          maxWidthOrHeight: DEFAULT_MAX_IMAGE_WIDTH_OR_HEIGHT,
        });
      } catch (error: any) {
        console.error(
          "Error trying to resizing image file on insertion",
          error,
        );
      }

      if (imageFile.size > MAX_ALLOWED_FILE_BYTES) {
        throw new Error(
          t("errors.fileTooBig", {
            maxSize: `${Math.trunc(MAX_ALLOWED_FILE_BYTES / 1024 / 1024)}MB`,
          }),
        );
      }
    }

    if (showCursorImagePreview) {
      const dataURL = this.files[fileId]?.dataURL;
      // optimization so that we don't unnecessarily resize the original
      // full-size file for cursor preview
      // (it's much faster to convert the resized dataURL to File)
      const resizedFile = dataURL && dataURLToFile(dataURL);

      this.setImagePreviewCursor(resizedFile || imageFile);
    }

    const dataURL =
      this.files[fileId]?.dataURL || (await getDataURL(imageFile));

    const imageElement = mutateElement(
      _imageElement,
      {
        fileId,
      },
      false,
    ) as NonDeleted<InitializedExcalidrawImageElement>;

    return new Promise<NonDeleted<InitializedExcalidrawImageElement>>(
      async (resolve, reject) => {
        try {
          this.addMissingFiles([
            {
              mimeType,
              id: fileId,
              dataURL,
              created: Date.now(),
              lastRetrieved: Date.now(),
            },
          ]);
          const cachedImageData = this.imageCache.get(fileId);
          if (!cachedImageData) {
            this.addNewImagesToImageCache();
            await this.updateImageCache([imageElement]);
          }
          if (cachedImageData?.image instanceof Promise) {
            await cachedImageData.image;
          }
          if (
            this.state.pendingImageElementId !== imageElement.id &&
            this.state.newElement?.id !== imageElement.id
          ) {
            this.initializeImageDimensions(imageElement, true);
          }
          resolve(imageElement);
        } catch (error: any) {
          console.error(error);
          reject(new Error(t("errors.imageInsertError")));
        } finally {
          if (!showCursorImagePreview) {
            resetCursor(this.interactiveCanvas);
          }
        }
      },
    );
  };

  /**
   * inserts image into elements array and rerenders
   */
  insertImageElement = async (
    imageElement: ExcalidrawImageElement,
    imageFile: File,
    showCursorImagePreview?: boolean,
  ) => {
    // we should be handling all cases upstream, but in case we forget to handle
    // a future case, let's throw here
    if (!this.isToolSupported("image")) {
      this.setState({ errorMessage: t("errors.imageToolNotSupported") });
      return;
    }

    this.scene.insertElement(imageElement);

    try {
      return await this.initializeImage({
        imageFile,
        imageElement,
        showCursorImagePreview,
      });
    } catch (error: any) {
      mutateElement(imageElement, {
        isDeleted: true,
      });
      this.actionManager.executeAction(actionFinalize);
      this.setState({
        errorMessage: error.message || t("errors.imageInsertError"),
      });
      return null;
    }
  };

  private setImagePreviewCursor = async (imageFile: File) => {
    // mustn't be larger than 128 px
    // https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Basic_User_Interface/Using_URL_values_for_the_cursor_property
    const cursorImageSizePx = 96;
    let imagePreview;

    try {
      imagePreview = await resizeImageFile(imageFile, {
        maxWidthOrHeight: cursorImageSizePx,
      });
    } catch (e: any) {
      if (e.cause === "UNSUPPORTED") {
        throw new Error(t("errors.unsupportedFileType"));
      }
      throw e;
    }

    let previewDataURL = await getDataURL(imagePreview);

    // SVG cannot be resized via `resizeImageFile` so we resize by rendering to
    // a small canvas
    if (imageFile.type === MIME_TYPES.svg) {
      const img = await loadHTMLImageElement(previewDataURL);

      let height = Math.min(img.height, cursorImageSizePx);
      let width = height * (img.width / img.height);

      if (width > cursorImageSizePx) {
        width = cursorImageSizePx;
        height = width * (img.height / img.width);
      }

      const canvas = document.createElement("canvas");
      canvas.height = height;
      canvas.width = width;
      const context = canvas.getContext("2d")!;

      context.drawImage(img, 0, 0, width, height);

      previewDataURL = canvas.toDataURL(MIME_TYPES.svg) as DataURL;
    }

    if (this.state.pendingImageElementId) {
      setCursor(this.interactiveCanvas, `url(${previewDataURL}) 4 4, auto`);
    }
  };

  private onImageAction = async ({
    insertOnCanvasDirectly,
  }: {
    insertOnCanvasDirectly: boolean;
  }) => {
    try {
      const clientX = this.state.width / 2 + this.state.offsetLeft;
      const clientY = this.state.height / 2 + this.state.offsetTop;

      const { x, y } = viewportCoordsToSceneCoords(
        { clientX, clientY },
        this.state,
      );

      const imageFile = await fileOpen({
        description: "Image",
        extensions: Object.keys(
          IMAGE_MIME_TYPES,
        ) as (keyof typeof IMAGE_MIME_TYPES)[],
      });

      const imageElement = this.createImageElement({
        sceneX: x,
        sceneY: y,
        addToFrameUnderCursor: false,
      });

      if (insertOnCanvasDirectly) {
        this.insertImageElement(imageElement, imageFile);
        this.initializeImageDimensions(imageElement);
        this.setState(
          {
            selectedElementIds: makeNextSelectedElementIds(
              { [imageElement.id]: true },
              this.state,
            ),
          },
          () => {
            this.actionManager.executeAction(actionFinalize);
          },
        );
      } else {
        this.setState(
          {
            pendingImageElementId: imageElement.id,
          },
          () => {
            this.insertImageElement(
              imageElement,
              imageFile,
              /* showCursorImagePreview */ true,
            );
          },
        );
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.error(error);
      } else {
        console.warn(error);
      }
      this.setState(
        {
          pendingImageElementId: null,
          newElement: null,
          activeTool: updateActiveTool(this.state, { type: "selection" }),
        },
        () => {
          this.actionManager.executeAction(actionFinalize);
        },
      );
    }
  };

  initializeImageDimensions = (
    imageElement: ExcalidrawImageElement,
    forceNaturalSize = false,
  ) => {
    const image =
      isInitializedImageElement(imageElement) &&
      this.imageCache.get(imageElement.fileId)?.image;

    if (!image || image instanceof Promise) {
      if (
        imageElement.width < DRAGGING_THRESHOLD / this.state.zoom.value &&
        imageElement.height < DRAGGING_THRESHOLD / this.state.zoom.value
      ) {
        const placeholderSize = 100 / this.state.zoom.value;
        mutateElement(imageElement, {
          x: imageElement.x - placeholderSize / 2,
          y: imageElement.y - placeholderSize / 2,
          width: placeholderSize,
          height: placeholderSize,
        });
      }

      return;
    }

    if (
      forceNaturalSize ||
      // if user-created bounding box is below threshold, assume the
      // intention was to click instead of drag, and use the image's
      // intrinsic size
      (imageElement.width < DRAGGING_THRESHOLD / this.state.zoom.value &&
        imageElement.height < DRAGGING_THRESHOLD / this.state.zoom.value)
    ) {
      const minHeight = Math.max(this.state.height - 120, 160);
      // max 65% of canvas height, clamped to <300px, vh - 120px>
      const maxHeight = Math.min(
        minHeight,
        Math.floor(this.state.height * 0.5) / this.state.zoom.value,
      );

      const height = Math.min(image.naturalHeight, maxHeight);
      const width = height * (image.naturalWidth / image.naturalHeight);

      // add current imageElement width/height to account for previous centering
      // of the placeholder image
      const x = imageElement.x + imageElement.width / 2 - width / 2;
      const y = imageElement.y + imageElement.height / 2 - height / 2;

      mutateElement(imageElement, {
        x,
        y,
        width,
        height,
        crop: null,
      });
    }
  };

  /** updates image cache, refreshing updated elements and/or setting status
      to error for images that fail during <img> element creation */
  private updateImageCache = async (
    elements: readonly InitializedExcalidrawImageElement[],
    files = this.files,
  ) => {
    const { updatedFiles, erroredFiles } = await _updateImageCache({
      imageCache: this.imageCache,
      fileIds: elements.map((element) => element.fileId),
      files,
    });
    if (updatedFiles.size || erroredFiles.size) {
      for (const element of elements) {
        if (updatedFiles.has(element.fileId)) {
          ShapeCache.delete(element);
        }
      }
    }
    if (erroredFiles.size) {
      this.scene.replaceAllElements(
        this.scene.getElementsIncludingDeleted().map((element) => {
          if (
            isInitializedImageElement(element) &&
            erroredFiles.has(element.fileId)
          ) {
            return newElementWith(element, {
              status: "error",
            });
          }
          return element;
        }),
      );
    }

    return { updatedFiles, erroredFiles };
  };

  /** adds new images to imageCache and re-renders if needed */
  private addNewImagesToImageCache = async (
    imageElements: InitializedExcalidrawImageElement[] = getInitializedImageElements(
      this.scene.getNonDeletedElements(),
    ),
    files: BinaryFiles = this.files,
  ) => {
    const uncachedImageElements = imageElements.filter(
      (element) => !element.isDeleted && !this.imageCache.has(element.fileId),
    );

    if (uncachedImageElements.length) {
      const { updatedFiles } = await this.updateImageCache(
        uncachedImageElements,
        files,
      );
      if (updatedFiles.size) {
        this.scene.triggerUpdate();
      }
    }
  };

  /** generally you should use `addNewImagesToImageCache()` directly if you need
   *  to render new images. This is just a failsafe  */
  private scheduleImageRefresh = throttle(() => {
    this.addNewImagesToImageCache();
  }, IMAGE_RENDER_TIMEOUT);

  private updateBindingEnabledOnPointerMove = (
    event: React.PointerEvent<HTMLElement>,
  ) => {
    const shouldEnableBinding = shouldEnableBindingForPointerEvent(event);
    if (this.state.isBindingEnabled !== shouldEnableBinding) {
      this.setState({ isBindingEnabled: shouldEnableBinding });
    }
  };

  private maybeSuggestBindingAtCursor = (pointerCoords: {
    x: number;
    y: number;
  }): void => {
    const hoveredBindableElement = getHoveredElementForBinding(
      pointerCoords,
      this.scene.getNonDeletedElements(),
      this.scene.getNonDeletedElementsMap(),
    );
    this.setState({
      suggestedBindings:
        hoveredBindableElement != null ? [hoveredBindableElement] : [],
    });
  };

  private maybeSuggestBindingsForLinearElementAtCoords = (
    linearElement: NonDeleted<ExcalidrawLinearElement>,
    /** scene coords */
    pointerCoords: {
      x: number;
      y: number;
    }[],
    // During line creation the start binding hasn't been written yet
    // into `linearElement`
    oppositeBindingBoundElement?: ExcalidrawBindableElement | null,
  ): void => {
    if (!pointerCoords.length) {
      return;
    }

    const suggestedBindings = pointerCoords.reduce(
      (acc: NonDeleted<ExcalidrawBindableElement>[], coords) => {
        const hoveredBindableElement = getHoveredElementForBinding(
          coords,
          this.scene.getNonDeletedElements(),
          this.scene.getNonDeletedElementsMap(),
          isArrowElement(linearElement) && isElbowArrow(linearElement),
        );
        if (
          hoveredBindableElement != null &&
          !isLinearElementSimpleAndAlreadyBound(
            linearElement,
            oppositeBindingBoundElement?.id,
            hoveredBindableElement,
          )
        ) {
          acc.push(hoveredBindableElement);
        }
        return acc;
      },
      [],
    );

    this.setState({ suggestedBindings });
  };

  private clearSelection(hitElement: ExcalidrawElement | null): void {
    this.setState((prevState) => ({
      selectedElementIds: makeNextSelectedElementIds({}, prevState),
      activeEmbeddable: null,
      selectedGroupIds: {},
      // Continue editing the same group if the user selected a different
      // element from it
      editingGroupId:
        prevState.editingGroupId &&
        hitElement != null &&
        isElementInGroup(hitElement, prevState.editingGroupId)
          ? prevState.editingGroupId
          : null,
    }));
    this.setState({
      selectedElementIds: makeNextSelectedElementIds({}, this.state),
      activeEmbeddable: null,
      previousSelectedElementIds: this.state.selectedElementIds,
    });
  }

  private handleInteractiveCanvasRef = (canvas: HTMLCanvasElement | null) => {
    // canvas is null when unmounting
    if (canvas !== null) {
      this.interactiveCanvas = canvas;

      // -----------------------------------------------------------------------
      // NOTE wheel, touchstart, touchend events must be registered outside
      // of react because react binds them them passively (so we can't prevent
      // default on them)
      this.interactiveCanvas.addEventListener(
        EVENT.TOUCH_START,
        this.onTouchStart,
        { passive: false },
      );
      this.interactiveCanvas.addEventListener(EVENT.TOUCH_END, this.onTouchEnd);
      // -----------------------------------------------------------------------
    } else {
      this.interactiveCanvas?.removeEventListener(
        EVENT.TOUCH_START,
        this.onTouchStart,
      );
      this.interactiveCanvas?.removeEventListener(
        EVENT.TOUCH_END,
        this.onTouchEnd,
      );
    }
  };

  private handleAppOnDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    // must be retrieved first, in the same frame
    const { file, fileHandle } = await getFileFromEvent(event);
    const { x: sceneX, y: sceneY } = viewportCoordsToSceneCoords(
      event,
      this.state,
    );

    try {
      // if image tool not supported, don't show an error here and let it fall
      // through so we still support importing scene data from images. If no
      // scene data encoded, we'll show an error then
      if (isSupportedImageFile(file) && this.isToolSupported("image")) {
        // first attempt to decode scene from the image if it's embedded
        // ---------------------------------------------------------------------

        if (file?.type === MIME_TYPES.png || file?.type === MIME_TYPES.svg) {
          try {
            const scene = await loadFromBlob(
              file,
              this.state,
              this.scene.getElementsIncludingDeleted(),
              fileHandle,
            );
            this.syncActionResult({
              ...scene,
              appState: {
                ...(scene.appState || this.state),
                isLoading: false,
              },
              replaceFiles: true,
              storeAction: StoreAction.CAPTURE,
            });
            return;
          } catch (error: any) {
            // Don't throw for image scene daa
            if (error.name !== "EncodingError") {
              throw new Error(t("alerts.couldNotLoadInvalidFile"));
            }
          }
        }

        // if no scene is embedded or we fail for whatever reason, fall back
        // to importing as regular image
        // ---------------------------------------------------------------------

        const imageElement = this.createImageElement({ sceneX, sceneY });
        this.insertImageElement(imageElement, file);
        this.initializeImageDimensions(imageElement);
        this.setState({
          selectedElementIds: makeNextSelectedElementIds(
            { [imageElement.id]: true },
            this.state,
          ),
        });

        return;
      }
    } catch (error: any) {
      return this.setState({
        isLoading: false,
        errorMessage: error.message,
      });
    }

    const libraryJSON = event.dataTransfer.getData(MIME_TYPES.excalidrawlib);
    if (libraryJSON && typeof libraryJSON === "string") {
      try {
        const libraryItems = parseLibraryJSON(libraryJSON);
        this.addElementsFromPasteOrLibrary({
          elements: distributeLibraryItemsOnSquareGrid(libraryItems),
          position: event,
          files: null,
        });
      } catch (error: any) {
        this.setState({ errorMessage: error.message });
      }
      return;
    }

    if (file) {
      // Attempt to parse an excalidraw/excalidrawlib file
      await this.loadFileToCanvas(file, fileHandle);
    }

    if (event.dataTransfer?.types?.includes("text/plain")) {
      const text = event.dataTransfer?.getData("text");
      if (
        text &&
        embeddableURLValidator(text, this.props.validateEmbeddable) &&
        (/^(http|https):\/\/[^\s/$.?#].[^\s]*$/.test(text) ||
          getEmbedLink(text)?.type === "video")
      ) {
        const embeddable = this.insertEmbeddableElement({
          sceneX,
          sceneY,
          link: normalizeLink(text),
        });
        if (embeddable) {
          this.setState({ selectedElementIds: { [embeddable.id]: true } });
        }
      }
    }
  };

  loadFileToCanvas = async (
    file: File,
    fileHandle: FileSystemHandle | null,
  ) => {
    file = await normalizeFile(file);
    try {
      const elements = this.scene.getElementsIncludingDeleted();
      let ret;
      try {
        ret = await loadSceneOrLibraryFromBlob(
          file,
          this.state,
          elements,
          fileHandle,
        );
      } catch (error: any) {
        const imageSceneDataError = error instanceof ImageSceneDataError;
        if (
          imageSceneDataError &&
          error.code === "IMAGE_NOT_CONTAINS_SCENE_DATA" &&
          !this.isToolSupported("image")
        ) {
          this.setState({
            isLoading: false,
            errorMessage: t("errors.imageToolNotSupported"),
          });
          return;
        }
        const errorMessage = imageSceneDataError
          ? t("alerts.cannotRestoreFromImage")
          : t("alerts.couldNotLoadInvalidFile");
        this.setState({
          isLoading: false,
          errorMessage,
        });
      }
      if (!ret) {
        return;
      }

      if (ret.type === MIME_TYPES.excalidraw) {
        // restore the fractional indices by mutating elements
        syncInvalidIndices(elements.concat(ret.data.elements));

        // update the store snapshot for old elements, otherwise we would end up with duplicated fractional indices on undo
        this.store.updateSnapshot(arrayToMap(elements), this.state);

        this.setState({ isLoading: true });
        this.syncActionResult({
          ...ret.data,
          appState: {
            ...(ret.data.appState || this.state),
            isLoading: false,
          },
          replaceFiles: true,
          storeAction: StoreAction.CAPTURE,
        });
      } else if (ret.type === MIME_TYPES.excalidrawlib) {
        await this.library
          .updateLibrary({
            libraryItems: file,
            merge: true,
            openLibraryMenu: true,
          })
          .catch((error) => {
            console.error(error);
            this.setState({ errorMessage: t("errors.importLibraryError") });
          });
      }
    } catch (error: any) {
      this.setState({ isLoading: false, errorMessage: error.message });
    }
  };

  private handleCanvasContextMenu = (
    event: React.MouseEvent<HTMLElement | HTMLCanvasElement>,
  ) => {
    event.preventDefault();

    if (
      (("pointerType" in event.nativeEvent &&
        event.nativeEvent.pointerType === "touch") ||
        ("pointerType" in event.nativeEvent &&
          event.nativeEvent.pointerType === "pen" &&
          // always allow if user uses a pen secondary button
          event.button !== POINTER_BUTTON.SECONDARY)) &&
      this.state.activeTool.type !== "selection"
    ) {
      return;
    }

    const { x, y } = viewportCoordsToSceneCoords(event, this.state);
    const element = this.getElementAtPosition(x, y, {
      preferSelected: true,
      includeLockedElements: true,
    });

    const selectedElements = this.scene.getSelectedElements(this.state);
    const isHittingCommonBoundBox =
      this.isHittingCommonBoundingBoxOfSelectedElements(
        { x, y },
        selectedElements,
      );

    const type = element || isHittingCommonBoundBox ? "element" : "canvas";

    const container = this.excalidrawContainerRef.current!;
    const { top: offsetTop, left: offsetLeft } =
      container.getBoundingClientRect();
    const left = event.clientX - offsetLeft;
    const top = event.clientY - offsetTop;

    trackEvent("contextMenu", "openContextMenu", type);

    this.setState(
      {
        ...(element && !this.state.selectedElementIds[element.id]
          ? {
              ...this.state,
              ...selectGroupsForSelectedElements(
                {
                  editingGroupId: this.state.editingGroupId,
                  selectedElementIds: { [element.id]: true },
                },
                this.scene.getNonDeletedElements(),
                this.state,
                this,
              ),
              selectedLinearElement: isLinearElement(element)
                ? new LinearElementEditor(element)
                : null,
            }
          : this.state),
        showHyperlinkPopup: false,
      },
      () => {
        this.setState({
          contextMenu: { top, left, items: this.getContextMenuItems(type) },
        });
      },
    );
  };

  private maybeDragNewGenericElement = (
    pointerDownState: PointerDownState,
    event: MouseEvent | KeyboardEvent,
    informMutation = true,
  ): void => {
    const selectionElement = this.state.selectionElement;
    const pointerCoords = pointerDownState.lastCoords;
    if (selectionElement && this.state.activeTool.type !== "eraser") {
      dragNewElement({
        newElement: selectionElement,
        elementType: this.state.activeTool.type,
        originX: pointerDownState.origin.x,
        originY: pointerDownState.origin.y,
        x: pointerCoords.x,
        y: pointerCoords.y,
        width: distance(pointerDownState.origin.x, pointerCoords.x),
        height: distance(pointerDownState.origin.y, pointerCoords.y),
        shouldMaintainAspectRatio: shouldMaintainAspectRatio(event),
        shouldResizeFromCenter: shouldResizeFromCenter(event),
        zoom: this.state.zoom.value,
        informMutation,
      });
      return;
    }

    const newElement = this.state.newElement;
    if (!newElement) {
      return;
    }

    let [gridX, gridY] = getGridPoint(
      pointerCoords.x,
      pointerCoords.y,
      event[KEYS.CTRL_OR_CMD] ? null : this.getEffectiveGridSize(),
    );

    const image =
      isInitializedImageElement(newElement) &&
      this.imageCache.get(newElement.fileId)?.image;
    const aspectRatio =
      image && !(image instanceof Promise) ? image.width / image.height : null;

    this.maybeCacheReferenceSnapPoints(event, [newElement]);

    const { snapOffset, snapLines } = snapNewElement(
      newElement,
      this,
      event,
      {
        x:
          pointerDownState.originInGrid.x +
          (this.state.originSnapOffset?.x ?? 0),
        y:
          pointerDownState.originInGrid.y +
          (this.state.originSnapOffset?.y ?? 0),
      },
      {
        x: gridX - pointerDownState.originInGrid.x,
        y: gridY - pointerDownState.originInGrid.y,
      },
      this.scene.getNonDeletedElementsMap(),
    );

    gridX += snapOffset.x;
    gridY += snapOffset.y;

    this.setState({
      snapLines,
    });

    dragNewElement({
      newElement,
      elementType: this.state.activeTool.type,
      originX: pointerDownState.originInGrid.x,
      originY: pointerDownState.originInGrid.y,
      x: gridX,
      y: gridY,
      width: distance(pointerDownState.originInGrid.x, gridX),
      height: distance(pointerDownState.originInGrid.y, gridY),
      shouldMaintainAspectRatio: isImageElement(newElement)
        ? !shouldMaintainAspectRatio(event)
        : shouldMaintainAspectRatio(event),
      shouldResizeFromCenter: shouldResizeFromCenter(event),
      zoom: this.state.zoom.value,
      widthAspectRatio: aspectRatio,
      originOffset: this.state.originSnapOffset,
      informMutation,
    });

    this.setState({
      newElement,
    });

    // highlight elements that are to be added to frames on frames creation
    if (
      this.state.activeTool.type === TOOL_TYPE.frame ||
      this.state.activeTool.type === TOOL_TYPE.magicframe
    ) {
      this.setState({
        elementsToHighlight: getElementsInResizingFrame(
          this.scene.getNonDeletedElements(),
          newElement as ExcalidrawFrameLikeElement,
          this.state,
          this.scene.getNonDeletedElementsMap(),
        ),
      });
    }
  };

  private maybeHandleCrop = (
    pointerDownState: PointerDownState,
    event: MouseEvent | KeyboardEvent,
  ): boolean => {
    // to crop, we must already be in the cropping mode, where croppingElement has been set
    if (!this.state.croppingElementId) {
      return false;
    }

    const transformHandleType = pointerDownState.resize.handleType;
    const pointerCoords = pointerDownState.lastCoords;
    const [x, y] = getGridPoint(
      pointerCoords.x - pointerDownState.resize.offset.x,
      pointerCoords.y - pointerDownState.resize.offset.y,
      this.getEffectiveGridSize(),
    );

    const croppingElement = this.scene
      .getNonDeletedElementsMap()
      .get(this.state.croppingElementId);

    if (
      transformHandleType &&
      croppingElement &&
      isImageElement(croppingElement)
    ) {
      const croppingAtStateStart = pointerDownState.originalElements.get(
        croppingElement.id,
      );

      const image =
        isInitializedImageElement(croppingElement) &&
        this.imageCache.get(croppingElement.fileId)?.image;

      if (
        croppingAtStateStart &&
        isImageElement(croppingAtStateStart) &&
        image &&
        !(image instanceof Promise)
      ) {
        mutateElement(
          croppingElement,
          cropElement(
            croppingElement,
            transformHandleType,
            image.naturalWidth,
            image.naturalHeight,
            x,
            y,
            event.shiftKey
              ? croppingAtStateStart.width / croppingAtStateStart.height
              : undefined,
          ),
        );

        updateBoundElements(
          croppingElement,
          this.scene.getNonDeletedElementsMap(),
          {
            newSize: {
              width: croppingElement.width,
              height: croppingElement.height,
            },
          },
        );

        this.setState({
          isCropping: transformHandleType && transformHandleType !== "rotation",
        });
      }

      return true;
    }

    return false;
  };

  private maybeHandleResize = (
    pointerDownState: PointerDownState,
    event: MouseEvent | KeyboardEvent,
  ): boolean => {
    const selectedElements = this.scene.getSelectedElements(this.state);
    const selectedFrames = selectedElements.filter(
      (element): element is ExcalidrawFrameLikeElement =>
        isFrameLikeElement(element),
    );

    const transformHandleType = pointerDownState.resize.handleType;

    if (
      // Frames cannot be rotated.
      (selectedFrames.length > 0 && transformHandleType === "rotation") ||
      // Elbow arrows cannot be transformed (resized or rotated).
      (selectedElements.length === 1 && isElbowArrow(selectedElements[0])) ||
      // Do not resize when in crop mode
      this.state.croppingElementId
    ) {
      return false;
    }

    this.setState({
      // TODO: rename this state field to "isScaling" to distinguish
      // it from the generic "isResizing" which includes scaling and
      // rotating
      isResizing: transformHandleType && transformHandleType !== "rotation",
      isRotating: transformHandleType === "rotation",
      activeEmbeddable: null,
    });
    const pointerCoords = pointerDownState.lastCoords;
    let [resizeX, resizeY] = getGridPoint(
      pointerCoords.x - pointerDownState.resize.offset.x,
      pointerCoords.y - pointerDownState.resize.offset.y,
      event[KEYS.CTRL_OR_CMD] ? null : this.getEffectiveGridSize(),
    );

    const frameElementsOffsetsMap = new Map<
      string,
      {
        x: number;
        y: number;
      }
    >();

    selectedFrames.forEach((frame) => {
      const elementsInFrame = getFrameChildren(
        this.scene.getNonDeletedElements(),
        frame.id,
      );

      elementsInFrame.forEach((element) => {
        frameElementsOffsetsMap.set(frame.id + element.id, {
          x: element.x - frame.x,
          y: element.y - frame.y,
        });
      });
    });

    // check needed for avoiding flickering when a key gets pressed
    // during dragging
    if (!this.state.selectedElementsAreBeingDragged) {
      const [gridX, gridY] = getGridPoint(
        pointerCoords.x,
        pointerCoords.y,
        event[KEYS.CTRL_OR_CMD] ? null : this.getEffectiveGridSize(),
      );

      const dragOffset = {
        x: gridX - pointerDownState.originInGrid.x,
        y: gridY - pointerDownState.originInGrid.y,
      };

      const originalElements = [...pointerDownState.originalElements.values()];

      this.maybeCacheReferenceSnapPoints(event, selectedElements);

      const { snapOffset, snapLines } = snapResizingElements(
        selectedElements,
        getSelectedElements(originalElements, this.state),
        this,
        event,
        dragOffset,
        transformHandleType,
      );

      resizeX += snapOffset.x;
      resizeY += snapOffset.y;

      this.setState({
        snapLines,
      });
    }

    if (
      transformElements(
        pointerDownState.originalElements,
        transformHandleType,
        selectedElements,
        this.scene.getElementsMapIncludingDeleted(),
        shouldRotateWithDiscreteAngle(event),
        shouldResizeFromCenter(event),
        selectedElements.some((element) => isImageElement(element))
          ? !shouldMaintainAspectRatio(event)
          : shouldMaintainAspectRatio(event),
        resizeX,
        resizeY,
        pointerDownState.resize.center.x,
        pointerDownState.resize.center.y,
      )
    ) {
      const suggestedBindings = getSuggestedBindingsForArrows(
        selectedElements,
        this.scene.getNonDeletedElementsMap(),
      );

      const elementsToHighlight = new Set<ExcalidrawElement>();
      selectedFrames.forEach((frame) => {
        getElementsInResizingFrame(
          this.scene.getNonDeletedElements(),
          frame,
          this.state,
          this.scene.getNonDeletedElementsMap(),
        ).forEach((element) => elementsToHighlight.add(element));
      });

      this.setState({
        elementsToHighlight: [...elementsToHighlight],
        suggestedBindings,
      });

      return true;
    }
    return false;
  };

  private getContextMenuItems = (
    type: "canvas" | "element",
  ): ContextMenuItems => {
    const options: ContextMenuItems = [];

    options.push(actionCopyAsPng, actionCopyAsSvg);

    // canvas contextMenu
    // -------------------------------------------------------------------------

    if (type === "canvas") {
      if (this.state.viewModeEnabled) {
        return [
          ...options,
          actionToggleGridMode,
          actionToggleZenMode,
          actionToggleViewMode,
          actionToggleStats,
        ];
      }

      return [
        actionPaste,
        CONTEXT_MENU_SEPARATOR,
        actionCopyAsPng,
        actionCopyAsSvg,
        copyText,
        CONTEXT_MENU_SEPARATOR,
        actionSelectAll,
        actionUnlockAllElements,
        CONTEXT_MENU_SEPARATOR,
        actionToggleGridMode,
        actionToggleObjectsSnapMode,
        actionToggleZenMode,
        actionToggleViewMode,
        actionToggleStats,
      ];
    }

    // element contextMenu
    // -------------------------------------------------------------------------

    options.push(copyText);

    if (this.state.viewModeEnabled) {
      return [actionCopy, ...options];
    }

    return [
      CONTEXT_MENU_SEPARATOR,
      actionCut,
      actionCopy,
      actionPaste,
      actionSelectAllElementsInFrame,
      actionRemoveAllElementsFromFrame,
      CONTEXT_MENU_SEPARATOR,
      actionToggleCropEditor,
      CONTEXT_MENU_SEPARATOR,
      ...options,
      CONTEXT_MENU_SEPARATOR,
      actionCopyStyles,
      actionPasteStyles,
      CONTEXT_MENU_SEPARATOR,
      actionGroup,
      actionTextAutoResize,
      actionUnbindText,
      actionBindText,
      actionWrapTextInContainer,
      actionUngroup,
      CONTEXT_MENU_SEPARATOR,
      actionAddToLibrary,
      CONTEXT_MENU_SEPARATOR,
      actionSendBackward,
      actionBringForward,
      actionSendToBack,
      actionBringToFront,
      CONTEXT_MENU_SEPARATOR,
      actionFlipHorizontal,
      actionFlipVertical,
      CONTEXT_MENU_SEPARATOR,
      actionToggleLinearEditor,
      actionLink,
      actionDuplicateSelection,
      actionToggleElementLock,
      CONTEXT_MENU_SEPARATOR,
      actionDeleteSelected,
    ];
  };

  private handleWheel = withBatchedUpdates(
    (
      event: WheelEvent | React.WheelEvent<HTMLDivElement | HTMLCanvasElement>,
    ) => {
      // if not scrolling on canvas/wysiwyg, ignore
      if (
        !(
          event.target instanceof HTMLCanvasElement ||
          event.target instanceof HTMLTextAreaElement ||
          event.target instanceof HTMLIFrameElement
        )
      ) {
        // prevent zooming the browser (but allow scrolling DOM)
        if (event[KEYS.CTRL_OR_CMD]) {
          event.preventDefault();
        }

        return;
      }

      event.preventDefault();

      if (isPanning) {
        return;
      }

      const { deltaX, deltaY } = event;
      // note that event.ctrlKey is necessary to handle pinch zooming
      if (event.metaKey || event.ctrlKey) {
        const sign = Math.sign(deltaY);
        const MAX_STEP = ZOOM_STEP * 100;
        const absDelta = Math.abs(deltaY);
        let delta = deltaY;
        if (absDelta > MAX_STEP) {
          delta = MAX_STEP * sign;
        }

        let newZoom = this.state.zoom.value - delta / 100;
        // increase zoom steps the more zoomed-in we are (applies to >100% only)
        newZoom +=
          Math.log10(Math.max(1, this.state.zoom.value)) *
          -sign *
          // reduced amplification for small deltas (small movements on a trackpad)
          Math.min(1, absDelta / 20);

        this.translateCanvas((state) => ({
          ...getStateForZoom(
            {
              viewportX: this.lastViewportPosition.x,
              viewportY: this.lastViewportPosition.y,
              nextZoom: getNormalizedZoom(newZoom),
            },
            state,
          ),
          shouldCacheIgnoreZoom: true,
        }));
        this.resetShouldCacheIgnoreZoomDebounced();
        return;
      }

      // scroll horizontally when shift pressed
      if (event.shiftKey) {
        this.translateCanvas(({ zoom, scrollX }) => ({
          // on Mac, shift+wheel tends to result in deltaX
          scrollX: scrollX - (deltaY || deltaX) / zoom.value,
        }));
        return;
      }

      this.translateCanvas(({ zoom, scrollX, scrollY }) => ({
        scrollX: scrollX - deltaX / zoom.value,
        scrollY: scrollY - deltaY / zoom.value,
      }));
    },
  );

  private getTextWysiwygSnappedToCenterPosition(
    x: number,
    y: number,
    appState: AppState,
    container?: ExcalidrawTextContainer | null,
  ) {
    if (container) {
      let elementCenterX = container.x + container.width / 2;
      let elementCenterY = container.y + container.height / 2;

      const elementCenter = getContainerCenter(
        container,
        appState,
        this.scene.getNonDeletedElementsMap(),
      );
      if (elementCenter) {
        elementCenterX = elementCenter.x;
        elementCenterY = elementCenter.y;
      }
      const distanceToCenter = Math.hypot(
        x - elementCenterX,
        y - elementCenterY,
      );
      const isSnappedToCenter =
        distanceToCenter < TEXT_TO_CENTER_SNAP_THRESHOLD;
      if (isSnappedToCenter) {
        const { x: viewportX, y: viewportY } = sceneCoordsToViewportCoords(
          { sceneX: elementCenterX, sceneY: elementCenterY },
          appState,
        );
        return { viewportX, viewportY, elementCenterX, elementCenterY };
      }
    }
  }

  private savePointer = (x: number, y: number, button: "up" | "down") => {
    if (!x || !y) {
      return;
    }
    const { x: sceneX, y: sceneY } = viewportCoordsToSceneCoords(
      { clientX: x, clientY: y },
      this.state,
    );

    if (isNaN(sceneX) || isNaN(sceneY)) {
      // sometimes the pointer goes off screen
    }

    const pointer: CollaboratorPointer = {
      x: sceneX,
      y: sceneY,
      tool: this.state.activeTool.type === "laser" ? "laser" : "pointer",
    };

    this.props.onPointerUpdate?.({
      pointer,
      button,
      pointersMap: gesture.pointers,
    });
  };

  private resetShouldCacheIgnoreZoomDebounced = debounce(() => {
    if (!this.unmounted) {
      this.setState({ shouldCacheIgnoreZoom: false });
    }
  }, 300);

  private updateDOMRect = (cb?: () => void) => {
    if (this.excalidrawContainerRef?.current) {
      const excalidrawContainer = this.excalidrawContainerRef.current;
      const {
        width,
        height,
        left: offsetLeft,
        top: offsetTop,
      } = excalidrawContainer.getBoundingClientRect();
      const {
        width: currentWidth,
        height: currentHeight,
        offsetTop: currentOffsetTop,
        offsetLeft: currentOffsetLeft,
      } = this.state;

      if (
        width === currentWidth &&
        height === currentHeight &&
        offsetLeft === currentOffsetLeft &&
        offsetTop === currentOffsetTop
      ) {
        if (cb) {
          cb();
        }
        return;
      }

      this.setState(
        {
          width,
          height,
          offsetLeft,
          offsetTop,
        },
        () => {
          cb && cb();
        },
      );
    }
  };

  public refresh = () => {
    this.setState({ ...this.getCanvasOffsets() });
  };

  private getCanvasOffsets(): Pick<AppState, "offsetTop" | "offsetLeft"> {
    if (this.excalidrawContainerRef?.current) {
      const excalidrawContainer = this.excalidrawContainerRef.current;
      const { left, top } = excalidrawContainer.getBoundingClientRect();
      return {
        offsetLeft: left,
        offsetTop: top,
      };
    }
    return {
      offsetLeft: 0,
      offsetTop: 0,
    };
  }

  private async updateLanguage() {
    const currentLang =
      languages.find((lang) => lang.code === this.props.langCode) ||
      defaultLang;
    await setLanguage(currentLang);
    this.setAppState({});
  }
}

// -----------------------------------------------------------------------------
// TEST HOOKS
// -----------------------------------------------------------------------------
// 声明全局类型扩展，扩展了 Window 对象的类型
declare global {
  interface Window {
    // 在 Window 对象上添加 `h` 属性，用于存储应用的全局状态和实例
    h: {
      scene: Scene; // 保存当前的场景对象，包含画布上的所有元素、背景等信息
      elements: readonly ExcalidrawElement[]; // 一个只读数组，保存所有的 Excalidraw 元素（未删除的元素）
      state: AppState; // 当前的应用状态，包含画布尺寸、视图位置等信息
      setState: React.Component<any, AppState>["setState"]; // 用于更新应用状态的 `setState` 方法
      app: InstanceType<typeof App>; // Excalidraw 应用的实例，类型为 App 类的实例
      history: History; // 用于管理 Excalidraw 历史记录的对象，支持撤销/重做等操作
      store: Store; // 应用的全局状态管理器，用于保存和管理应用的各种数据
    };
  }
}

// 创建一个用于测试的 Hook 函数
export const createTestHook = () => {
  // 判断当前环境是否为测试环境 (ENV.TEST) 或开发环境 (import.meta.env.DEV)
  if (import.meta.env.MODE === ENV.TEST || import.meta.env.DEV) {
    // 确保 `window.h` 存在，如果没有，则初始化它为空对象
    window.h = window.h || ({} as Window["h"]);

    // 使用 Object.defineProperties 来定义 `window.h` 上的 `elements` 和 `scene` 属性
    Object.defineProperties(window.h, {
      // `elements` 属性：获取和设置 Excalidraw 元素
      elements: {
        configurable: true, // 允许删除或修改这个属性的配置
        get() {
          // 获取 Excalidraw 元素：返回当前场景中的所有元素，包括已删除的
          return this.app?.scene.getElementsIncludingDeleted();
        },
        set(elements: ExcalidrawElement[]) {
          // 设置 Excalidraw 元素：替换场景中的所有元素，同时同步无效的元素索引
          return this.app?.scene.replaceAllElements(
            syncInvalidIndices(elements), // `syncInvalidIndices` 用来确保元素索引有效
          );
        },
      },
      // `scene` 属性：获取当前的 Excalidraw 场景
      scene: {
        configurable: true, // 允许删除或修改这个属性的配置
        get() {
          // 返回当前的 `scene`（如果存在 `app` 和 `scene`）
          return this.app?.scene;
        },
      },
    });
  }
};

// 调用 `createTestHook` 函数以在测试环境中启用对 `window.h` 的全局访问
createTestHook();

// 默认导出 Excalidraw 应用的主要组件（App）
export default App;
