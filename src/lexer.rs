#[derive(Debug)]
pub struct LexerError(pub String);

pub struct Lexer {
    program: String,
    cur_idx: usize,
}

fn is_symbol_char(c: char) -> bool {
    c.is_alphanumeric() || c == '-'
}

fn is_number_char(c: char) -> bool {
    c.is_digit(10) || c == '.'
}

impl Lexer {
    pub fn new(program: String) -> Self {
        Self {
            program,
            cur_idx: 0,
        }
    }

    fn cur(&self) -> char {
        self.program.chars().nth(self.cur_idx).unwrap()
    }

    fn chomp(&mut self) -> char {
        let c = self.cur();
        self.cur_idx += 1;
        c
    }

    fn ended(&self) -> bool {
        self.cur_idx >= self.program.len()
    }

    fn next(&mut self) -> Result<Token, LexerError> {
        if self.ended() {
            return Ok(Token::EOF)
        }
        let mut c = self.chomp();
        while !self.ended() && (c == ' ' || c == '\n') {
            c = self.chomp();
        }
        match c {
            '(' => Ok(Token::LParen),
            ')' => Ok(Token::RParen),
            'a'..'z' => {
                let mut symbol = String::from(c);
                while !self.ended() && is_symbol_char(self.cur()) {
                    symbol.push(self.chomp());
                }
                Ok(Token::Symbol(symbol))
            },
            '0'..'9' => {
                let mut number = String::from(c);
                let mut float = false;
                while !self.ended() && is_number_char(self.cur()) {
                    if self.cur() == '.' {
                        float = true;
                    }

                    number.push(self.chomp());
                }

                if float {
                    Ok(Token::Float(number.parse().unwrap()))
                } else {
                    Ok(Token::Integer(number.parse().unwrap()))
                }
            },
            ';' => {
                let mut comment = String::new();
                while !self.ended() && self.cur() != '\n' {
                    comment.push(self.chomp());
                }
                Ok(Token::Comment(comment))
            },
            _ => Err(LexerError(format!("lexer error: {}", c)))
        }
    }

    pub fn tokens(&mut self) -> Result<Vec<Token>, LexerError> {
        let mut toks = Vec::new();
        loop {
            let tok = self.next()?;
            if tok == Token::EOF {
                break;
            } else {
                toks.push(tok);
            }
        }

        Ok(toks)
    }
}

#[derive(PartialEq, Debug, Clone)]
pub enum Token {
    LParen,
    RParen,
    Symbol(String),
    Integer(isize),
    Float(f32),
    Dot,
    Comment(String),
    EOF,
}
