package com.igrejasara.sarabackend.controllers;

import org.springframework.dao.DataIntegrityViolationException;
import com.igrejasara.sarabackend.entities.Membro;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.igrejasara.sarabackend.service.MembroService;

import java.util.List;

@RestController // Diz que esta classe vai ter requisições da internet
@RequestMapping("api/membros") // Esta é a url padrão(End point) que eu defini
@CrossOrigin(origins = "*")

public class MembroController {

    @Autowired
    private MembroService service;

    @GetMapping
    public ResponseEntity<List<Membro>> buscarTodos(){
        List<Membro> lista = service.listarTodos();
        return ResponseEntity.ok(lista);
    }

    @PostMapping
    public ResponseEntity<Membro> criarMembro(@RequestBody Membro membro){
        Membro membroSalvo = service.salvarMembro(membro);
        return ResponseEntity.status(HttpStatus.CREATED).body(membroSalvo);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Membro> atualizarMembro(@PathVariable Long id, @RequestBody Membro membro) {
        return service.atualizarMembro(id, membro)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> excluirMembro(@PathVariable Long id) {
        try {
            return service.excluirMembro(id)
                    ? ResponseEntity.noContent().build()
                    : ResponseEntity.notFound().build();
        } catch (DataIntegrityViolationException e) {
            // Membro é líder, co-líder ou anfitrião de alguma célula
            return ResponseEntity.status(HttpStatus.CONFLICT).build();
        }
    }
}
