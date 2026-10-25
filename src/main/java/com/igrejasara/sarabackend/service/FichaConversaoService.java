package com.igrejasara.sarabackend.service;

import java.util.Optional;
import com.igrejasara.sarabackend.entities.FichaConversao;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.igrejasara.sarabackend.repositories.FichaConversaoRepository;

import java.time.LocalDate;
import java.util.List;

@Service
public class FichaConversaoService {
    @Autowired
    private FichaConversaoRepository repository;

    public FichaConversao salvarFicha(FichaConversao ficha){
      //A data da ficha sempre é a atual que foi cadastrada no sistema
        ficha.setDataFicha(LocalDate.now());
        return repository.save(ficha);
    }

    public List<FichaConversao> listarTodas(){
        return repository.findAll();
    }

    public Optional<FichaConversao> atualizarFicha(Long id, FichaConversao dados) {
        return repository.findById(id).map(existente -> {
            dados.setId(id);
            dados.setDataFicha(existente.getDataFicha()); // mantém a data original
            return repository.save(dados);
        });
    }

    public boolean excluirFicha(Long id) {
        if (!repository.existsById(id)) {
            return false;
        }
        repository.deleteById(id);
        return true;
    }
}
