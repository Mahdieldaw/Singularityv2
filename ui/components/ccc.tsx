import AiTurnBlockConnected from "./AiTurnBlockConnected";

activeSynthesisClipProviderId?: string;
activeMappingClipProviderId?: string;
onClipClick?: (type: "synthesis" | "mapping", providerId: string) => void;
isSynthesisExpanded?: boolean;
onToggleSynthesisExpanded?: () => void;
isMappingExpanded?: boolean;
onToggleMappingExpanded?: () => void;
synthExpanded?: boolean;
onSetSynthExpanded?: (v: boolean) => void;
mapExpanded?: boolean;
onSetMapExpanded?: (v: boolean) => void;
mappingTab?: "map" | "options";
onSetMappingTab?: (t: "map" | "options") => void;
children?: React.ReactNode;
}

@@ -194,17 +204,24 @@ const AiTurnBlock: React.FC<AiTurnBlockProps> = ({
activeSynthesisClipProviderId,
activeMappingClipProviderId,
onClipClick,
isSynthesisExpanded = true,
onToggleSynthesisExpanded,
isMappingExpanded = true,
onToggleMappingExpanded,
synthExpanded = false,
onSetSynthExpanded,
mapExpanded = false,
onSetMapExpanded,
mappingTab = "map",
onSetMappingTab,
children,
}) => {



const mapProseRef = useRef<HTMLDivElement>(null);
const optionsProseRef = useRef<HTMLDivElement>(null);

// Track which section is manually expanded (if truncated)
const setSynthExpanded = onSetSynthExpanded || (() => {});
const setMapExpanded = onSetMapExpanded || (() => {});

// ✅ CRITICAL: Move all hooks to top level (before any conditional logic)

@@ -1218,7 +1235,10 @@ const AiTurnBlock: React.FC<AiTurnBlockProps> = ({
                  Unified Synthesis
                </h4>
                <button
                  type="button"
                  onClick={() =>
                    onToggleSynthesisExpanded && onToggleSynthesisExpanded()
                  }
                  style={{
                    background: "none",
                    border: "none",
@@ -1427,6 +1447,7 @@ const AiTurnBlock: React.FC<AiTurnBlockProps> = ({
                                {activeSynthPid} · {take.status}
                              </div>
                              <button
                                type="button"
                                onClick={handleCopy}
                                style={{
                                  background: "#334155",
@@ -1492,6 +1513,7 @@ const AiTurnBlock: React.FC<AiTurnBlockProps> = ({
                      />

                      <button
                        type="button"
                        onClick={() => setSynthExpanded(true)}
                        style={{
                          position: "absolute",
@@ -1519,6 +1541,7 @@ const AiTurnBlock: React.FC<AiTurnBlockProps> = ({

                  {synthExpanded && synthTruncated && (
                    <button
                      type="button"
                      onClick={() => setSynthExpanded(false)}
                      style={{
                        marginTop: 12,
@@ -1566,7 +1589,8 @@ const AiTurnBlock: React.FC<AiTurnBlockProps> = ({
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  <button
                    type="button"
                    onClick={() => onSetMappingTab && onSetMappingTab("map")}
                    title="Decision Map"
                    style={{
                      padding: 6,
@@ -1582,7 +1606,10 @@ const AiTurnBlock: React.FC<AiTurnBlockProps> = ({
                    🗺️
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onSetMappingTab && onSetMappingTab("options")
                    }
                    title="All Options"
                    style={{
                      padding: "4px 8px",
@@ -1603,6 +1630,7 @@ const AiTurnBlock: React.FC<AiTurnBlockProps> = ({
                    <ListIcon style={{ width: 16, height: 16 }} />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      // ... ✅ FIX "Copy All" logic here
                      try {
@@ -1695,7 +1723,10 @@ const AiTurnBlock: React.FC<AiTurnBlockProps> = ({
                    }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onToggleMappingExpanded && onToggleMappingExpanded()
                    }
                    style={{
                      background: "none",
                      border: "none",
@@ -1786,6 +1817,7 @@ const AiTurnBlock: React.FC<AiTurnBlockProps> = ({
                                All Available Options • via {activeMappingPid}
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  try {
@@ -1937,6 +1969,7 @@ const AiTurnBlock: React.FC<AiTurnBlockProps> = ({
                                  {activeMappingPid} · {take.status}
                                </div>
                                <button
                                  type="button"
                                  onClick={handleCopy}
                                  style={{
                                    background: "#334155",
@@ -2048,6 +2081,7 @@ const AiTurnBlock: React.FC<AiTurnBlockProps> = ({
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setMapExpanded(true)}
                        style={{
                          position: "absolute",
@@ -2075,6 +2109,7 @@ const AiTurnBlock: React.FC<AiTurnBlockProps> = ({

                  {mapExpanded && mapTruncated && (
                    <button
                      type="button"
                      onClick={() => setMapExpanded(false)}
                      style={{
                        marginTop: 12,
@@ -2115,6 +2150,7 @@ const AiTurnBlock: React.FC<AiTurnBlockProps> = ({
                  style={{ textAlign: "center", marginBottom: 8 }}
                >
                  <button
                    type="button"
                    onClick={() => onToggleSourceOutputs?.()}
                    style={{
                      padding: "6px 12px",





                      and AiTurnBlockConnected


                      activeClipsAtom,
                      activeAiTurnIdAtom,
                      activeRecomputeStateAtom,
                      aiTurnSynthesisExpandedFamily,
                      aiTurnMappingExpandedFamily,
                      aiTurnSynthExpandedFamily,
                      aiTurnMapExpandedFamily,
                      aiTurnMappingTabFamily,
                    } from "../state/atoms";
                    import { useClipActions } from "../hooks/useClipActions";
                    import { useEligibility } from "../hooks/useEligibility";
                    @@ -35,6 +40,21 @@ export default function AiTurnBlockConnected({
                      const { handleClipClick } = useClipActions();
                      const { eligibilityMaps } = useEligibility();
                      const [activeRecomputeState] = useAtom(activeRecomputeStateAtom);
                      const [isSynthesisExpanded, setIsSynthesisExpanded] = useAtom(
                        aiTurnSynthesisExpandedFamily(aiTurn.id),
                      );
                      const [isMappingExpanded, setIsMappingExpanded] = useAtom(
                        aiTurnMappingExpandedFamily(aiTurn.id),
                      );
                      const [synthExpanded, setSynthExpanded] = useAtom(
                        aiTurnSynthExpandedFamily(aiTurn.id),
                      );
                      const [mapExpanded, setMapExpanded] = useAtom(
                        aiTurnMapExpandedFamily(aiTurn.id),
                      );
                      const [mappingTab, setMappingTab] = useAtom(
                        aiTurnMappingTabFamily(aiTurn.id),
                      );
                    
                      const isLive = !!activeAiTurnId && activeAiTurnId === aiTurn.id;
                    
                    @@ -53,6 +73,31 @@ export default function AiTurnBlockConnected({
                            () => setShowSourceOutputs((prev) => !prev),
                            [setShowSourceOutputs],
                          )}
                          isSynthesisExpanded={isSynthesisExpanded}
                          onToggleSynthesisExpanded={useCallback(
                            () => setIsSynthesisExpanded((prev) => !prev),
                            [setIsSynthesisExpanded],
                          )}
                          isMappingExpanded={isMappingExpanded}
                          onToggleMappingExpanded={useCallback(
                            () => setIsMappingExpanded((prev) => !prev),
                            [setIsMappingExpanded],
                          )}
                          synthExpanded={synthExpanded}
                          onSetSynthExpanded={useCallback(
                            (v: boolean) => setSynthExpanded(v),
                            [setSynthExpanded],
                          )}
                          mapExpanded={mapExpanded}
                          onSetMapExpanded={useCallback(
                            (v: boolean) => setMapExpanded(v),
                            [setMapExpanded],
                          )}
                          mappingTab={mappingTab}
                          onSetMappingTab={useCallback(
                            (t: "map" | "options") => setMappingTab(t),
                            [setMappingTab],
                          )}
                          activeSynthesisClipProviderId={turnClips.synthesis}
                          activeMappingClipProviderId={turnClips.mapping}
                          onClipClick={useCallback(