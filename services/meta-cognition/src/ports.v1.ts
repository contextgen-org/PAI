import type {
  KnowThatWriteBatchRequestV1,
  KnowThatWriteBatchResponseV1,
  MemoryWriteBatchRequestV1,
  MemoryWriteBatchResponseV1,
} from "@pai/contracts";

export interface MetaMemoryWritePortV1 {
  writeBatch(
    request: MemoryWriteBatchRequestV1,
    signal: AbortSignal,
  ): Promise<MemoryWriteBatchResponseV1>;
  checkReadiness?(signal: AbortSignal): Promise<void>;
}

export interface MetaKnowThatCandidatePortV1 {
  writeBatch(
    request: KnowThatWriteBatchRequestV1,
    signal: AbortSignal,
  ): Promise<KnowThatWriteBatchResponseV1>;
  checkReadiness?(signal: AbortSignal): Promise<void>;
}
