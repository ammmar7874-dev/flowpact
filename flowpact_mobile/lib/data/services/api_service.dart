import '../models/contract_model.dart';

abstract class ApiService {
  Future<List<ContractModel>> getContracts();
  Future<ContractModel> getContractById(String contractId);
  Future<ContractModel> createContract({
    required String projectTitle,
    required String scopeDescription,
    required String clientName,
    required double amount,
    required String freelancerWallet,
  });
}
